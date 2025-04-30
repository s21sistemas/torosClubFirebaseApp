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
import * as FileSystem from 'expo-file-system';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

const { width, height } = Dimensions.get("window");

const PagosScreen = ({ route, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [pagoData, setPagoData] = useState(null);
  const [error, setError] = useState(null);
  const [jugadorId, setJugadorId] = useState(null);
  const [esPorrista, setEsPorrista] = useState(false);
  const [alCorriente, setAlCorriente] = useState(false);

  // Función mejorada para formatear fechas de Firestore
  const formatFirestoreDate = (timestamp) => {
    if (!timestamp) return null;
    
    // Si ya es un string en formato aaaa/mm/dd
    if (typeof timestamp === 'string' && timestamp.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
      return timestamp.replace(/\//g, '-'); // Convertir a aaaa-mm-dd para el calendario
    }
    
    // Si es un string en otro formato (por si acaso)
    if (typeof timestamp === 'string') {
      return timestamp.split('T')[0]; // Tomar solo la parte de la fecha
    }
    
    // Si es un timestamp de Firestore
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
        // Asegurarnos de que la fecha esté en formato aaaa-mm-dd
        const formattedDate = fechaFormateada.includes('/') 
          ? fechaFormateada.replace(/\//g, '-')
          : fechaFormateada;
        
        marked[formattedDate] = {
          marked: true,
          dotColor: pago.estatus === "pendiente" ? "#FF5252" : "#4CAF50",
          selected: true,
          selectedColor: pago.estatus === "pendiente" ? "#FFD700" : "#81C784",
          selectedTextColor: pago.estatus === "pendiente" ? "#000" : "#FFF",
          customStyles: {
            container: {
              borderRadius: 20,
              backgroundColor: pago.estatus === "pendiente" ? "#FFF3E0" : "#E8F5E9",
              borderWidth: 1,
              borderColor: pago.estatus === "pendiente" ? "#FFA000" : "#66BB6A",
              elevation: 3,
              shadowColor: pago.estatus === "pendiente" ? "#FF6D00" : "#2E7D32",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 3,
            },
            text: {
              color: pago.estatus === "pendiente" ? "#D84315" : "#1B5E20",
              fontWeight: 'bold',
              fontSize: 14,
            },
          }
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
            // Mantenemos el formato original para mostrar al usuario
            fecha_limite: typeof pago.fecha_limite === 'string' 
              ? pago.fecha_limite 
              : formatFirestoreDate(pago.fecha_limite)?.replace(/-/g, '/'),
            fecha_pago: typeof pago.fecha_pago === 'string' 
              ? pago.fecha_pago 
              : formatFirestoreDate(pago.fecha_pago)?.replace(/-/g, '/'),
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

  
  const generatePDF = async (pago) => {
    try {
      // Crear el HTML para el PDF
      const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              padding: 30px;
              color: #333;
              line-height: 1.5;
            }
            .header { 
              text-align: center; 
              margin-bottom: 25px;
              border-bottom: 2px solid #eaeaea;
              padding-bottom: 20px;
            }
            .logo {
              height: 80px;
              margin-bottom: 15px;
            }
            .title { 
              font-size: 22px; 
              font-weight: bold;
              color: #2c3e50;
              margin: 10px 0 5px 0;
            }
            .subtitle {
              font-size: 16px;
              color: #7f8c8d;
              margin-bottom: 5px;
            }
            .address {
              font-size: 14px;
              color: #7f8c8d;
              margin-top: 15px;
            }
            .section {
              margin-bottom: 25px;
              background: #f9f9f9;
              padding: 15px 20px;
              border-radius: 5px;
              border-left: 4px solid #3498db;
            }
            .section h3 {
              margin-top: 0;
              color: #2c3e50;
              border-bottom: 1px solid #eee;
              padding-bottom: 8px;
            }
            .info-row {
              display: flex;
              margin-bottom: 8px;
            }
            .info-label {
              font-weight: bold;
              width: 150px;
              color: #34495e;
            }
            .info-value {
              flex: 1;
            }
            .status-paid {
              color: #27ae60;
              font-weight: bold;
            }
            .status-pending {
              color: #e67e22;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              font-size: 12px;
              color: #95a5a6;
              border-top: 1px solid #eee;
              padding-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="./assets/LogoToros.jpg" 
                 class="logo" 
                 alt="Logo Club Toros" />
            <div class="title">COMPROBANTE DE PAGO</div>
            <div class="subtitle">${esPorrista ? 'Porrista' : 'Jugador'}</div>
            <div class="address"></div>
          </div>
          
          <div class="section">
            <h3>Información del ${esPorrista ? 'Porrista' : 'Jugador'}</h3>
            <div class="info-row">
              <div class="info-label">Nombre:</div>
              <div class="info-value">${pagoData.nombre_jugador}</div>
            </div>
            ${pagoData.numero ? `
            <div class="info-row">
              <div class="info-label">Número:</div>
              <div class="info-value">${pagoData.numero}</div>
            </div>` : ''}
          </div>
          
          <div class="section">
            <h3>Detalles del Pago</h3>
            <div class="info-row">
              <div class="info-label">Concepto:</div>
              <div class="info-value">${pago.tipo}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Monto:</div>
              <div class="info-value">$${pago.monto}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Fecha límite:</div>
              <div class="info-value">${pago.fecha_limite}</div>
            </div>
            ${pago.fecha_pago ? `
            <div class="info-row">
              <div class="info-label">Fecha de pago:</div>
              <div class="info-value">${pago.fecha_pago}</div>
            </div>` : ''}
            <div class="info-row">
              <div class="info-label">Estado:</div>
              <div class="info-value ${pago.estatus === 'pagado' ? 'status-paid' : 'status-pending'}">
                ${pago.estatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
              </div>
            </div>
          </div>
          
          <div class="footer">
            Documento generado el ${new Date().toLocaleDateString()} - Club Toros © ${new Date().getFullYear()}
          </div>
        </body>
      </html>
      `;
  
      if (Platform.OS === 'web') {
        // Solución para WEB
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      } else {
        // Solución para MÓVIL (Android/iOS)
        const { uri } = await Print.printToFileAsync({
          html,
          width: 612,   // Ancho carta en puntos (8.5 pulgadas)
          height: 792,  // Alto carta en puntos (11 pulgadas)
        });
  
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Compartir comprobante',
            UTI: 'com.adobe.pdf'
          });
        } else {
          // Alternativa si Sharing no está disponible
          alert(`PDF generado en: ${uri}`);
        }
      }
    } catch (error) {
      console.error('Error al generar el PDF:', error);
      alert('Error al generar el recibo. Por favor, inténtalo de nuevo.');
    }
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
                markingType={'custom'}
                theme={{
                  calendarBackground: "#fff",
                  selectedDayBackgroundColor: "#FFD700",
                  selectedDayTextColor: "#000",
                  todayTextColor: "#2196F3",
                  dayTextColor: "#2d4150",
                  textDisabledColor: "#d9e1e8",
                  textSectionTitleColor: "#333",
                  monthTextColor: "#333",
                  arrowColor: "#333",
                  "stylesheet.calendar.header": {
                    header: {
                      height: 50,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingHorizontal: 10,
                      backgroundColor: "#f5f5f5",
                      borderBottomWidth: 1,
                      borderBottomColor: "#e0e0e0",
                    },
                    monthText: {
                      fontSize: 18,
                      fontWeight: "bold",
                      color: "#333",
                    },
                    arrow: {
                      padding: 12,
                    },
                    week: {
                      marginTop: 10,
                      flexDirection: "row",
                      justifyContent: "space-around",
                      backgroundColor: "#f5f5f5",
                      paddingVertical: 8,
                    },
                  },
                  "stylesheet.day.basic": {
                    base: {
                      width: 36,
                      height: 36,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 18,
                    },
                    text: {
                      fontSize: 16,
                      fontWeight: "500",
                      color: "#2d4150",
                    },
                  },
                  "stylesheet.calendar.main": {
                    container: {
                      padding: 0,
                    },
                  },
                }}
                dayComponent={({date, state, marking}) => {
                  const isMarked = marking?.marked;
                  const isSelected = marking?.selected;
                  const isToday = date.dateString === new Date().toISOString().split('T')[0];
                  const isPending = marking?.dotColor === "#FF5252";
                  
                  return (
                    <TouchableOpacity
                      style={[
                        styles.calendarDay,
                        isSelected && styles.calendarDaySelected,
                        state === 'disabled' && styles.calendarDayDisabled,
                        isToday && !isSelected && styles.calendarDayToday,
                        isPending && !isSelected && styles.calendarDayPending,
                      ]}
                      disabled={state === 'disabled'}
                      onPress={() => {
                        if (isMarked) {
                          const pago = pagoData.pagos.find(p => {
                            const pagoDate = formatFirestoreDate(p.fecha_limite);
                            return pagoDate === date.dateString || 
                                   pagoDate?.replace(/\//g, '-') === date.dateString;
                          });
                          if (pago) {
                            alert(`Pago ${pago.estatus}\nTipo: ${pago.tipo}\nMonto: $${pago.monto}\nFecha: ${pago.fecha_limite}`);
                          }
                        }
                      }}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        isSelected && styles.calendarDayTextSelected,
                        state === 'disabled' && styles.calendarDayTextDisabled,
                        isToday && !isSelected && styles.calendarDayTextToday,
                        isPending && !isSelected && styles.calendarDayTextPending,
                      ]}>
                        {date.day}
                      </Text>
                      {isMarked && (
                        <View style={[
                          styles.calendarDot,
                          isSelected && styles.calendarDotSelected,
                          isPending && styles.calendarDotPending,
                        ]}/>
                      )}
                    </TouchableOpacity>
                  );
                }}
                hideExtraDays={false}
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
                    onPress={() => generatePDF(pago)}
                  >
                    <Text style={styles.downloadButtonText}>Descargar recibo</Text>
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
                dayComponent={({date, state, marking}) => {
                  const isMarked = marking?.marked;
                  const isSelected = marking?.selected;
                  const isToday = date.dateString === new Date().toISOString().split('T')[0];
                  const isPending = marking?.dotColor === "#FF5252";
                  
                  return (
                    <TouchableOpacity
                      style={[
                        styles.calendarDay,
                        isSelected && styles.calendarDaySelected,
                        state === 'disabled' && styles.calendarDayDisabled,
                        isToday && !isSelected && styles.calendarDayToday,
                        isPending && !isSelected && styles.calendarDayPending,
                      ]}
                      disabled={state === 'disabled'}
                      onPress={() => {
                        if (isMarked) {
                          const pago = pagoData.pagos.find(p => {
                            const pagoDate = formatFirestoreDate(p.fecha_limite);
                            return pagoDate === date.dateString || 
                                   pagoDate?.replace(/\//g, '-') === date.dateString;
                          });
                          if (pago) {
                            alert(`Pago ${pago.estatus}\nTipo: ${pago.tipo}\nMonto: $${pago.monto}\nFecha: ${pago.fecha_limite}`);
                          }
                        }
                      }}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        isSelected && styles.calendarDayTextSelected,
                        state === 'disabled' && styles.calendarDayTextDisabled,
                        isToday && !isSelected && styles.calendarDayTextToday,
                        isPending && !isSelected && styles.calendarDayTextPending,
                      ]}>
                        {date.day}
                      </Text>
                      {isMarked && (
                        <View style={[
                          styles.calendarDot,
                          isSelected && styles.calendarDotSelected,
                          isPending && styles.calendarDotPending,
                        ]}/>
                      )}
                    </TouchableOpacity>
                  );
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
                    onPress={() => generatePDF(pago)}
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

// Los estilos permanecen exactamente iguales
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
  calendarDay: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    margin: 2,
  },
  calendarDaySelected: {
    backgroundColor: '#FFD700',
    elevation: 4,
    shadowColor: '#FFA000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  calendarDayPending: {
    backgroundColor: '#FFF3E0',
  },
  calendarDayDisabled: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2d4150',
  },
  calendarDayTextSelected: {
    color: '#000',
    fontWeight: 'bold',
  },
  calendarDayTextToday: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  calendarDayTextPending: {
    color: '#D84315',
    fontWeight: 'bold',
  },
  calendarDayTextDisabled: {
    color: '#d9e1e8',
  },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginTop: 2,
  },
  calendarDotSelected: {
    backgroundColor: '#000',
  },
  calendarDotPending: {
    backgroundColor: '#FF5252',
  },
});

export default PagosScreen;