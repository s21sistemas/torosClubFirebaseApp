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
  Alert, Image
} from "react-native";
import { Calendar } from "react-native-calendars";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
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

  // Función para formatear fechas
  const formatFirestoreDate = (timestamp) => {
    if (!timestamp) return null;
    
    if (typeof timestamp === 'string') {
      // Si ya está en formato aaaa-mm-dd
      if (timestamp.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return timestamp;
      }
      // Si está en formato aaaa/mm/dd
      if (timestamp.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
        return timestamp.replace(/\//g, '-');
      }
      // Si es un string ISO
      return timestamp.split('T')[0];
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

  // Obtener datos del jugador/porrista
  const fetchPlayerData = async (id) => {
    try {
      const playerCollection = esPorrista ? 'porristas' : 'jugadores';
      const playerDoc = await getDoc(doc(db, playerCollection, id));
      return playerDoc.exists() ? playerDoc.data() : null;
    } catch (error) {
      console.error("Error fetching player data:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!jugadorId) return;

    const collectionName = esPorrista ? "pagos_porristas" : "pagos_jugadores";
    const q = query(
      collection(db, collectionName), 
      where(esPorrista ? "porristaId" : "jugadorId", "==", jugadorId)
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      try {
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data();
          const playerData = await fetchPlayerData(jugadorId);
          
          // Procesar pagos según la estructura definida
          const pagosFormateados = docData.pagos.map((pago) => ({
            estatus: pago.estatus || "pendiente",
            fecha_limite: formatFirestoreDate(pago.fecha_limite)?.replace(/-/g, '/'),
            fecha_pago: pago.estatus === "pagado" ? formatFirestoreDate(pago.fecha_pago)?.replace(/-/g, '/') : null,
            monto: pago.monto || 0,
            tipo: pago.tipo || "Pago",
            ...(pago.abono === "SI" && {
              abono: pago.abono,
              abonos: pago.abonos || [],
              total_abonado: pago.total_abonado || 0
            }),
            ...(pago.beca && { beca: pago.beca }),
            ...(pago.descuento && { descuento: pago.descuento }),
            ...(pago.prorroga && { prorroga: pago.prorroga })
          }));

          // Calcular montos según la estructura de pagos
          const montoTotalPagado = pagosFormateados
            .filter(pago => pago.estatus === "pagado")
            .reduce((sum, pago) => sum + (pago.monto - (pago.descuento || 0)), 0);

          const montoTotalPendiente = pagosFormateados
            .filter(pago => pago.estatus === "pendiente")
            .reduce((sum, pago) => sum + (pago.monto - (pago.descuento || 0)), 0);

          const transformedData = {
            id: querySnapshot.docs[0].id,
            [esPorrista ? "porristaId" : "jugadorId"]: jugadorId,
            monto_total: docData.monto_total || (esPorrista ? 1000 : 1500),
            monto_total_pagado: montoTotalPagado,
            monto_total_pendiente: montoTotalPendiente,
            nombre_jugador: playerData?.nombre ? 
              `${playerData.nombre} ${playerData.apellido_p} ${playerData.apellido_m}` : 
              (esPorrista ? "Porrista" : "Jugador"),
            categoria: playerData?.categoria || "N/A",
            numero: playerData?.numero_mfl || "N/A",
            pagos: pagosFormateados,
            fecha_registro: formatFirestoreDate(docData.fecha_registro)?.replace(/-/g, '/')
          };
          
          setPagoData(transformedData);
          setAlCorriente(montoTotalPendiente === 0);
        } else {
          setError(`No se encontraron datos de pagos para este ${esPorrista ? "porrista" : "jugador"}.`);
        }
      } catch (error) {
        console.error("Error al procesar los pagos:", error);
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

  // Generar fechas marcadas para el calendario
  const getMarkedDates = () => {
    if (!pagoData) return {};
    
    const marked = {};
    pagoData.pagos.forEach((pago) => {
      const fechaFormateada = formatFirestoreDate(pago.fecha_limite);
      if (fechaFormateada) {
        marked[fechaFormateada] = {
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

  // Generar PDF con los detalles del pago
  const generatePDF = async (pago) => {
    let logoBase64 = '';
    try {
      // Convertir la imagen a base64 (solo para móvil)
      if (Platform.OS !== 'web') {
        try {
          const image = require('../assets/logoToros.jpg');
          const response = await fetch(Image.resolveAssetSource(image).uri);
          const blob = await response.blob();
          const reader = new FileReader();
          
          logoBase64 = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (imageError) {
          console.warn('No se pudo cargar la imagen del logo:', imageError);
        }
      } else {
        // Para web (usa la ruta pública)
        logoBase64 = '/logoToros.jpg';
      }
  
      // Obtener la fecha actual formateada
      const today = new Date();
      const formattedDate = today.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
  
      // Crear el HTML para el PDF con el nuevo formato
      const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 0;
              margin: 0;
              color: #000;
              font-size: 14px;
            }
            .container {
              width: 100%;
              max-width: 600px;
              margin: 0 auto;
              padding: 15px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 1px solid #000;
              padding-bottom: 10px;
              position: relative;
            }
            .logo {
              position: absolute;
              left: 0;
              top: 0;
              width: 80px;
              height: auto;
            }
            .header-content {
              margin-left: ${logoBase64 ? '90px' : '0'};
            }
            .club-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .club-subtitle {
              font-size: 14px;
              margin-bottom: 10px;
            }
            .club-address {
              font-size: 12px;
              margin-bottom: 5px;
            }
            .club-phone {
              font-size: 12px;
              margin-bottom: 10px;
            }
            .separator {
              border-top: 1px dashed #000;
              margin: 15px 0;
            }
            .receipt-title {
              font-size: 16px;
              font-weight: bold;
              text-align: center;
              margin: 15px 0;
            }
            .receipt-line {
              display: flex;
              margin-bottom: 10px;
            }
            .receipt-label {
              width: 120px;
              font-weight: bold;
            }
            .receipt-value {
              flex: 1;
              border-bottom: 1px solid #000;
              padding-left: 10px;
            }
            .payment-method {
              display: flex;
              margin-top: 15px;
            }
            .payment-option {
              margin-right: 20px;
              display: flex;
              align-items: center;
            }
            .signature-line {
              margin-top: 40px;
              text-align: center;
              border-top: 1px solid #000;
              width: 200px;
              margin-left: auto;
              margin-right: auto;
              padding-top: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Logo Club Potros" />` : ''}
              <div class="header-content">
                <div class="club-name">CLUB POTROS DE LA ANÁHUAC</div>
                <div class="club-subtitle">FRATERNIDAD LEGÍTIMOS POTROS, A.C.</div>
                <div class="club-address">Porfirio Barba Jacob No. 901, Col. Anáhuac, San Nicolás de los Garza, N.L.</div>
                <div class="club-phone">Tels. 81-8376-1777 / 81-2236-0535</div>
              </div>
            </div>
  
            <div class="separator"></div>
  
            <div class="receipt-title">RECIBO</div>
  
            <div class="receipt-line">
              <div class="receipt-label">Recibí:</div>
              <div class="receipt-value">${pagoData.nombre_jugador}</div>
            </div>
  
            <div class="receipt-line">
              <div class="receipt-label">La cantidad de $</div>
              <div class="receipt-value">${pago.monto}</div>
            </div>
  
            <div class="receipt-line">
              <div class="receipt-label">Por concepto de</div>
              <div class="receipt-value">${pago.tipo}</div>
            </div>
  
            <div class="receipt-line">
              <div class="receipt-value" style="margin-left: 120px;"></div>
            </div>
  
            <div class="receipt-line">
              <div class="receipt-label">${esPorrista ? 'Porrista' : 'Jugador'}</div>
              <div class="receipt-value">${pagoData.nombre_jugador}</div>
            </div>
  
            ${!esPorrista ? `
            <div class="receipt-line">
              <div class="receipt-label">Categoria</div>
              <div class="receipt-value">${pagoData.categoria}</div>
            </div>
            ` : ''}
  
            <div class="payment-method">
              <div class="payment-option">
                <div class="receipt-label">Novato</div>
              </div>
              <div class="payment-option">
                <div class="receipt-label">Veterano</div>
              </div>
              <div class="payment-option">
                <div class="receipt-label">Efectivo</div>
              </div>
              <div class="payment-option">
                <div class="receipt-label">Cheque No.</div>
                <div class="receipt-value" style="width: 50px; margin-left: 5px;"></div>
              </div>
            </div>
  
            <div class="receipt-line">
              <div class="receipt-label">Fecha</div>
              <div class="receipt-value">${formattedDate}</div>
            </div>
  
            <div class="separator"></div>
  
            <div class="receipt-line" style="margin-top: 20px;">
              <div class="receipt-label">Recibí:</div>
              <div class="receipt-value"></div>
            </div>
  
            <div class="footer">
              Documento generado el ${formattedDate} - Club Potros © ${today.getFullYear()}
            </div>
          </div>
        </body>
      </html>
      `;
  
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html.replace('../assets/logoToros.jpg', '/assets/logoToros.jpg'));
        printWindow.document.close();
        printWindow.print();
      } else {
        const { uri } = await Print.printToFileAsync({
          html,
          width: 612,  // Tamaño carta en puntos (8.5 x 11 pulgadas)
          height: 792,
        });
  
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Compartir recibo',
            UTI: 'com.adobe.pdf'
          });
        } else {
          Alert.alert('PDF generado', `Archivo guardado en: ${uri}`);
        }
      }
    } catch (error) {
      console.error('Error al generar el PDF:', error);
      Alert.alert('Error', 'No se pudo generar el recibo');
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
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
                        return pagoDate === date.dateString;
                      });
                      if (pago) {
                        Alert.alert(
                          `Detalle de pago - ${pago.tipo}`,
                          `Estado: ${pago.estatus}\n` +
                          `Monto: $${pago.monto}\n` +
                          `Fecha límite: ${pago.fecha_limite}\n` +
                          (pago.fecha_pago ? `Fecha pago: ${pago.fecha_pago}\n` : '') +
                          (pago.beca ? `Beca: ${pago.beca}%\n` : '') +
                          (pago.descuento ? `Descuento: $${pago.descuento}\n` : '')
                        );
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
            <Text style={styles.summaryValue}>{pagoData.nombre_jugador}</Text>
          </View>
          {!esPorrista && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Categoría:</Text>
              <Text style={styles.summaryValue}>{pagoData.categoria}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Número:</Text>
            <Text style={styles.summaryValue}>{pagoData.numero}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total:</Text>
            <Text style={styles.summaryValue}>${pagoData.monto_total}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pagado:</Text>
            <Text style={[styles.summaryValue, styles.paidAmount]}>
              ${pagoData.monto_total_pagado}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pendiente:</Text>
            <Text style={[styles.summaryValue, styles.pendingAmount]}>
              ${pagoData.monto_total_pendiente}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Detalle de Pagos</Text>

        {pagoData.pagos.map((pago, index) => (
          <View
            key={index}
            style={[
              styles.paymentCard,
              pago.estatus === "pendiente" ? styles.pendingCard : styles.paidCard
            ]}
          >
            <View style={styles.paymentHeader}>
              <Text style={styles.paymentType}>{pago.tipo}</Text>
              <Text style={[
                styles.paymentStatus,
                pago.estatus === "pendiente" ? styles.pendingText : styles.paidText
              ]}>
                {pago.estatus.toUpperCase()}
              </Text>
            </View>

            <Text style={styles.paymentAmount}>${pago.monto}</Text>

            {pago.beca && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Beca:</Text>
                <Text style={styles.detailValue}>{pago.beca}%</Text>
              </View>
            )}

            {pago.descuento && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Descuento:</Text>
                <Text style={styles.detailValue}>${pago.descuento}</Text>
              </View>
            )}

            {pago.fecha_limite && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fecha límite:</Text>
                <Text style={styles.detailValue}>{pago.fecha_limite}</Text>
              </View>
            )}

            {pago.fecha_pago && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fecha pago:</Text>
                <Text style={styles.detailValue}>{pago.fecha_pago}</Text>
              </View>
            )}

            {pago.abono === 'SI' && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Abonos:</Text>
                <Text style={styles.detailValue}>
                  ${pago.total_abonado || 0} de ${pago.monto}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => generatePDF(pago)}
            >
              <Text style={styles.downloadButtonText}>Generar comprobante</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// Estilos (se mantienen iguales)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
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
    height: 350,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 15,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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