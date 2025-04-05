import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  Platform,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const PagosScreen = ({ route, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [pagoData, setPagoData] = useState(null);
  const [error, setError] = useState(null);
  const [jugadorId, setJugadorId] = useState(null);
  const [esPorrista, setEsPorrista] = useState(false);
  const [alCorriente, setAlCorriente] = useState(false);

  // Función para formatear fechas de Firestore
  const formatFirestoreDate = (timestamp) => {
    if (!timestamp) return null;
    
    if (typeof timestamp === 'string') return timestamp;
    
    if (timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return date.toISOString().split('T')[0];
    }
    
    return null;
  };

  useEffect(() => {
    if (route.params?.jugadorId) {
      setJugadorId(route.params.jugadorId);
    }
    if (route.params?.esPorrista) {
      setEsPorrista(route.params.esPorrista);
    }
  }, [route.params]);

  const getMarkedDates = () => {
    if (!pagoData) return {};
    
    const marked = {};
    pagoData.pagos.forEach((pago) => {
      const fechaFormateada = formatFirestoreDate(pago.fecha_limite);
      if (fechaFormateada) {
        marked[fechaFormateada] = {
          marked: true,
          dotColor: pago.estatus === "pendiente" ? "red" : "green",
          selected: true,
          selectedColor: pago.estatus === "pendiente" ? "#FFD700" : "#32CD32",
        };
      }
    });
    return marked;
  };

  useEffect(() => {
    if (!jugadorId) return;

    const collectionName = esPorrista ? "pagos_porristas" : "pagos_jugadores";
    const q = query(
      collection(db, collectionName), 
      where("jugadorId", "==", jugadorId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      try {
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data();
          
          const pagosFormateados = docData.pagos.map((pago) => ({
            estatus: pago.estatus || "pendiente",
            fecha_limite: formatFirestoreDate(pago.fecha_limite),
            fecha_pago: formatFirestoreDate(pago.fecha_pago),
            monto: pago.monto || 0,
            tipo: pago.tipo || "Pago",
            beca: pago.beca || 0,
            descuento: pago.descuento || 0,
            prorroga: pago.prorroga || false,
          }));

          // Calcular montos
          const montoTotalPagado = pagosFormateados
            .filter(pago => pago.estatus === "pagado")
            .reduce((sum, pago) => sum + pago.monto, 0);

          const montoTotalPendiente = pagosFormateados
            .filter(pago => pago.estatus === "pendiente")
            .reduce((sum, pago) => sum + pago.monto, 0);

          const transformedData = {
            jugador_id: jugadorId,
            monto_total: 2000, // Fijo en $2000 como solicitaste
            monto_total_pagado: montoTotalPagado,
            monto_total_pendiente: montoTotalPendiente,
            nombre_jugador: docData.nombre || (esPorrista ? "Porrista" : "Jugador"),
            pagos: pagosFormateados,
          };
          
          setPagoData(transformedData);
          setAlCorriente(montoTotalPendiente === 0);
        } else {
          setError(`No se encontraron datos de pagos para este ${esPorrista ? "porrista" : "jugador"}.`);
        }
      } catch (error) {
        console.error("Error al obtener los pagos:", error);
        setError("Error al cargar los pagos. Inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Error en la suscripción:", error);
      setError("Error en la conexión con la base de datos.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [jugadorId, esPorrista]);

  const handleDownload = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error("No se pudo abrir el enlace", err)
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffbe00" />
        <Text style={styles.loadingText}>Cargando información de pagos...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            setError(null);
          }}
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!pagoData) {
    return (
      <View style={styles.noDataContainer}>
        <Text style={styles.noDataText}>No se encontraron datos de pagos.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {Platform.OS === "web" ? (
        <div style={styles.webOuterContainer}>
          <div style={styles.webInnerContainer}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.header}>
                <Text style={styles.headerTitle}>
                  Pagos de {pagoData?.nombre_jugador || (esPorrista ? "Porrista" : "Jugador")}
                </Text>
              </View>

              <View style={styles.calendarWrapper}>
                <Calendar
                  style={styles.calendar}
                  markedDates={getMarkedDates()}
                  markingType={"period"}
                  theme={{
                    calendarBackground: "#fff",
                    selectedDayBackgroundColor: "#FFD700",
                    selectedDayTextColor: "#000",
                    todayTextColor: "#00adf5",
                    dayTextColor: "#2d4150",
                    textDisabledColor: "#d9e1e8",
                    textSectionTitleColor: "#333",
                    monthTextColor: "#333",
                    arrowColor: "#333",
                    "stylesheet.calendar.header": {
                      header: {
                        height: 40,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingHorizontal: 10,
                      },
                      monthText: {
                        fontSize: 16,
                        fontWeight: "bold",
                      },
                      arrow: {
                        padding: 10,
                      },
                      week: {
                        marginTop: 7,
                        flexDirection: "row",
                        justifyContent: "space-around",
                      },
                    },
                    "stylesheet.day.basic": {
                      base: {
                        width: 32,
                        height: 32,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 16,
                      },
                      text: {
                        fontSize: 14,
                        fontWeight: "400",
                        color: "#2d4150",
                      },
                    },
                  }}
                  hideExtraDays={true}
                />
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Resumen de Pagos</Text>
                
                {alCorriente && (
                  <View style={styles.alCorrienteContainer}>
                    <Text style={styles.alCorrienteText}>¡Estás al corriente con tus pagos!</Text>
                  </View>
                )}
                
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{esPorrista ? "Porrista:" : "Jugador:"}</Text>
                  <Text style={styles.summaryValue}>
                    {pagoData?.nombre_jugador || "N/A"}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total:</Text>
                  <Text style={styles.summaryValue}>
                    ${pagoData?.monto_total || 0}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Pagado:</Text>
                  <Text style={[styles.summaryValue, styles.paidAmount]}>
                    ${pagoData?.monto_total_pagado || 0}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Pendiente:</Text>
                  <Text style={[styles.summaryValue, styles.pendingAmount]}>
                    ${pagoData?.monto_total_pendiente || 0}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Detalle de Pagos</Text>

              {pagoData?.pagos?.map((pago, index) => (
                <View
                  key={index}
                  style={[
                    styles.paymentCard,
                    pago.estatus === "pendiente"
                      ? styles.pendingCard
                      : styles.paidCard,
                  ]}
                >
                  <View style={styles.paymentHeader}>
                    <Text style={styles.paymentType}>{pago.tipo}</Text>
                    <Text
                      style={[
                        styles.paymentStatus,
                        pago.estatus === "pendiente"
                          ? styles.pendingText
                          : styles.paidText,
                      ]}
                    >
                      {pago.estatus}
                    </Text>
                  </View>

                  <Text style={styles.paymentAmount}>${pago.monto}</Text>

                  {pago.fecha_limite && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Fecha límite:</Text>
                      <Text style={styles.detailValue}>{pago.fecha_limite}</Text>
                    </View>
                  )}

                  {pago.fecha_pago && pago.estatus === "pagado" && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Fecha de pago:</Text>
                      <Text style={styles.detailValue}>{pago.fecha_pago}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={() =>
                      handleDownload("https://ejemplo.com/formato-pago.pdf")
                    }
                  >
                    <Text style={styles.downloadButtonText}>
                      Descargar recibo
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </div>
        </div>
      ) : (
        <View style={styles.mobileContainer}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                Pagos de {pagoData?.nombre_jugador || (esPorrista ? "Porrista" : "Jugador")}
              </Text>
            </View>

            <View style={styles.calendarWrapper}>
              <Calendar
                style={styles.calendar}
                markedDates={getMarkedDates()}
                markingType={"period"}
                theme={{
                  calendarBackground: "#fff",
                  selectedDayBackgroundColor: "#FFD700",
                  selectedDayTextColor: "#000",
                  todayTextColor: "#00adf5",
                  dayTextColor: "#2d4150",
                  textDisabledColor: "#d9e1e8",
                  textSectionTitleColor: "#333",
                  monthTextColor: "#333",
                  arrowColor: "#333",
                  "stylesheet.calendar.header": {
                    header: {
                      height: 40,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingHorizontal: 10,
                    },
                    monthText: {
                      fontSize: 16,
                      fontWeight: "bold",
                    },
                    arrow: {
                      padding: 10,
                    },
                    week: {
                      marginTop: 7,
                      flexDirection: "row",
                      justifyContent: "space-around",
                    },
                  },
                  "stylesheet.day.basic": {
                    base: {
                      width: 32,
                      height: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 16,
                    },
                    text: {
                      fontSize: 14,
                      fontWeight: "400",
                      color: "#2d4150",
                    },
                  },
                }}
                hideExtraDays={true}
              />
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumen de Pagos</Text>
              
              {alCorriente && (
                <View style={styles.alCorrienteContainer}>
                  <Text style={styles.alCorrienteText}>¡Estás al corriente con tus pagos!</Text>
                </View>
              )}
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{esPorrista ? "Porrista:" : "Jugador:"}</Text>
                <Text style={styles.summaryValue}>
                  {pagoData?.nombre_jugador || "N/A"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total:</Text>
                <Text style={styles.summaryValue}>
                  ${pagoData?.monto_total || 0}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pagado:</Text>
                <Text style={[styles.summaryValue, styles.paidAmount]}>
                  ${pagoData?.monto_total_pagado || 0}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pendiente:</Text>
                <Text style={[styles.summaryValue, styles.pendingAmount]}>
                  ${pagoData?.monto_total_pendiente || 0}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Detalle de Pagos</Text>

            {pagoData?.pagos?.map((pago, index) => (
              <View
                key={index}
                style={[
                  styles.paymentCard,
                  pago.estatus === "pendiente"
                    ? styles.pendingCard
                    : styles.paidCard,
                ]}
              >
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentType}>{pago.tipo}</Text>
                  <Text
                    style={[
                      styles.paymentStatus,
                      pago.estatus === "pendiente"
                        ? styles.pendingText
                        : styles.paidText,
                    ]}
                  >
                    {pago.estatus}
                  </Text>
                </View>

                <Text style={styles.paymentAmount}>${pago.monto}</Text>

                {pago.fecha_limite && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fecha límite:</Text>
                    <Text style={styles.detailValue}>{pago.fecha_limite}</Text>
                  </View>
                )}

                {pago.fecha_pago && pago.estatus === "pagado" && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fecha de pago:</Text>
                    <Text style={styles.detailValue}>{pago.fecha_pago}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() =>
                    handleDownload("https://ejemplo.com/formato-pago.pdf")
                  }
                >
                  <Text style={styles.downloadButtonText}>Descargar recibo</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
};

// Estilos (exactamente iguales a los que proporcionaste)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  webOuterContainer: {
    width: "100%",
    height: "90vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  webInnerContainer: {
    width: "100%",
    maxWidth: 1000,
    height: "100%",
    overflow: "auto",
    WebkitOverflowScrolling: "touch",
  },
  mobileContainer: {
    flex: 1,
  },
  scrollView: {
    width: "100%",
    height: "100%",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    minHeight: Platform.OS === "web" ? "100%" : "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    width: "100%",
    ...Platform.select({
      web: {
        paddingTop: 20,
      },
    }),
  },
  backButton: {
    marginRight: 15,
    position: "absolute",
    left: 0,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    ...Platform.select({
      web: {
        fontSize: 24,
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#333",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  errorText: {
    fontSize: 16,
    color: "#d9534f",
    marginBottom: 20,
    textAlign: "center",
  },
  noDataContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  noDataText: {
    fontSize: 16,
    color: "#777",
  },
  retryButton: {
    backgroundColor: "#ffbe00",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 5,
    elevation: 2,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  calendarWrapper: {
    height: 400,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 15,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    ...Platform.select({
      web: {
        width: "100%",
        maxWidth: 600,
        alignSelf: "center",
      },
    }),
  },
  calendar: {
    height: "100%",
    width: "100%",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    ...Platform.select({
      web: {
        width: "100%",
        maxWidth: 600,
        alignSelf: "center",
      },
    }),
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#555",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  paidAmount: {
    color: "#32CD32",
  },
  pendingAmount: {
    color: "#FF6347",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    marginLeft: 5,
    ...Platform.select({
      web: {
        textAlign: "center",
        marginLeft: 0,
        fontSize: 18,
      },
    }),
  },
  paymentCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    ...Platform.select({
      web: {
        width: "100%",
        maxWidth: 600,
        alignSelf: "center",
      },
    }),
  },
  pendingCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#FF6347",
  },
  paidCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#32CD32",
  },
  paymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  paymentType: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
  },
  paymentStatus: {
    fontSize: 13,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pendingText: {
    backgroundColor: "#FFEBEE",
    color: "#D32F2F",
  },
  paidText: {
    backgroundColor: "#E8F5E9",
    color: "#388E3C",
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: "#666",
    marginRight: 5,
  },
  detailValue: {
    fontSize: 13,
    color: "#333",
  },
  downloadButton: {
    backgroundColor: "#ffbe00",
    borderRadius: 5,
    padding: 8,
    alignItems: "center",
    marginTop: 8,
  },
  downloadButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
  // Agregado para el mensaje de al corriente
  alCorrienteContainer: {
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#388E3C',
  },
  alCorrienteText: {
    color: '#388E3C',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default PagosScreen;