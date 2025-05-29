import React, { useState, useEffect } from "react";
import {
  View, Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  Platform,
  Image, 
  Alert
} from "react-native";
import { Calendar } from "react-native-calendars";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
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
  const [temporadaData, setTemporadaData] = useState(null);
  const [error, setError] = useState(null);
  const [jugadorId, setJugadorId] = useState(null);
  const [esPorrista, setEsPorrista] = useState(false);
  const [alCorriente, setAlCorriente] = useState(false);

  // Función para formatear fechas de Firestore
  const formatTipoPago = (tipo) => {
    return tipo === "Túnel" ? "Aportación" : tipo;
  };

  const formatFirestoreDate = (dateString) => {
    if (!dateString) return null;
    
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    
    if (typeof dateString === 'string' && dateString.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
      return dateString.replace(/\//g, '-');
    }
    
    if (dateString?.seconds) {
      const date = new Date(dateString.seconds * 1000);
      return date.toISOString().split('T')[0];
    }
    
    if (dateString instanceof Date) {
      return dateString.toISOString().split('T')[0];
    }
    
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn("No se pudo parsear la fecha:", dateString);
    }
    
    return null;
  };

  // Función para verificar si ha pasado una semana desde el último pago
  const checkSemanaPago = (fechaUltimoPago) => {
    if (!fechaUltimoPago) return true;
    
    let fechaPago;
    if (typeof fechaUltimoPago === 'string') {
      const parts = fechaUltimoPago.split(/[/-]/);
      fechaPago = new Date(parts[0], parts[1] - 1, parts[2]);
    } else if (fechaUltimoPago.seconds) {
      fechaPago = new Date(fechaUltimoPago.seconds * 1000);
    } else {
      fechaPago = new Date(fechaUltimoPago);
    }
    
    const hoy = new Date();
    const fechaPagoMidnight = new Date(fechaPago.getFullYear(), fechaPago.getMonth(), fechaPago.getDate());
    const hoyMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    
    const diffTiempo = hoyMidnight.getTime() - fechaPagoMidnight.getTime();
    const diffDias = diffTiempo / (1000 * 60 * 60 * 24);
    
    return diffDias >= 7;
  };

  // Función segura para formatear números
  const safeToFixed = (value, decimals = 2) => {
    const num = Number(value) || 0;
    return num.toFixed(decimals);
  };

  useEffect(() => {
    if (route.params?.jugadorId) {
      setJugadorId(route.params.jugadorId);
    }
    if (route.params?.esPorrista) {
      setEsPorrista(route.params.esPorrista);
    }
  }, [route.params]);

  // Función para obtener datos de temporada
  const fetchTemporadaData = async (temporadaInfo) => {
    try {
      if (!temporadaInfo) return;
      
      if (temporadaInfo.label && temporadaInfo.value) {
        setTemporadaData(temporadaInfo);
        return;
      }
      
      if (typeof temporadaInfo === 'string') {
        const temporadaRef = doc(db, "temporadas", temporadaInfo);
        const temporadaSnap = await getDoc(temporadaRef);
        
        if (temporadaSnap.exists()) {
          setTemporadaData({
            label: temporadaSnap.data().temporada || 'Temporada no especificada',
            value: temporadaSnap.id
          });
        }
      }
    } catch (error) {
      console.error("Error al obtener datos de temporada:", error);
    }
  };

  const getMarkedDates = () => {
    if (!pagoData?.pagos) return {};
    
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

  useEffect(() => {
    if (!jugadorId) return;

    const collectionName = esPorrista ? "pagos_porristas" : "pagos_jugadores";
    const fieldName = esPorrista ? "porristaId" : "jugadorId";
    
    const q = query(
      collection(db, collectionName), 
      where(fieldName, "==", jugadorId)
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      try {
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data();
          
         const pagosFormateados = docData.pagos.map((pago) => {
  // Determinar el estado basado en el total abonado
  const totalAbonado = pago.total_abonado || 0;
  const montoPago = pago.monto || 0;
  const estatus = totalAbonado >= montoPago ? "pagado" : (pago.estatus || "pendiente");

  return {
    estatus: estatus,
    fecha_limite: pago.fecha_limite || null,
    fecha_pago: pago.fecha_pago || null,
    monto: montoPago,
    tipo: pago.tipo || "Pago",
    beca: pago.beca || "0",
    descuento: pago.descuento || "0",
    prorroga: pago.prorroga || false,
    metodo_pago: pago.metodo_pago || null,
    abono: pago.abono || "NO",
    abonos: pago.abonos || [],
    total_abonado: totalAbonado,
    submonto: pago.submonto || 0
  };
});

          if (docData.temporadaId) {
            await fetchTemporadaData(docData.temporadaId);
          }

            const montoTotalPagado = docData.monto_total_pagado || pagosFormateados
      .filter(pago => pago.estatus === "pagado")
      .reduce((sum, pago) => sum + (pago.submonto || pago.monto), 0);

    const montoTotalPendiente = docData.monto_total_pendiente || pagosFormateados
      .filter(pago => pago.estatus === "pendiente")
      .reduce((sum, pago) => sum + (pago.monto - (pago.total_abonado || 0)), 0);

          const transformedData = {
            id: querySnapshot.docs[0].id,
            jugadorId: jugadorId,
            monto_total: docData.monto_total || 0,
            monto_total_pagado: montoTotalPagado,
            monto_total_pendiente: montoTotalPendiente,
            nombre_jugador: docData.nombre || (esPorrista ? "Porrista" : "Jugador"),
            categoria: docData.categoria || null,
            temporadaId: docData.temporadaId || null,
            fecha_registro: docData.fecha_registro || new Date().toISOString().split('T')[0],
            pagos: pagosFormateados,
          };
          
          setPagoData(transformedData);
          setAlCorriente(montoTotalPendiente <= 0);
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

  const generatePDF = async (pago) => {
    let logoBase64 = '';
    try {
      if (Platform.OS !== 'web') {
        try {
          const image = require('../assets/logoToros.jpg');
          logoBase64 = await FileSystem.readAsStringAsync(
            Image.resolveAssetSource(image).uri, 
            { encoding: FileSystem.EncodingType.Base64 }
          );
          logoBase64 = `data:image/jpeg;base64,${logoBase64}`;
        } catch (imageError) {
          console.warn('No se pudo cargar la imagen del logo:', imageError);
        }
      } else {
        logoBase64 = '/logoToros.jpg';
      }
  
      const today = new Date();
      const formattedDate = today.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
  

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
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-bottom: 25px;
              border-bottom: 2px solid #eaeaea;
              padding-bottom: 20px;
            }
            .logo {
              height: 80px;
              width: auto;
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
            .temporada-info {
              background-color: #e3f2fd;
              padding: 10px;
              border-radius: 5px;
              margin-bottom: 15px;
              text-align: center;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Logo Club Toros" />` : ''}
            <div class="title">COMPROBANTE DE PAGO</div>
            <div class="subtitle">${esPorrista ? 'Porrista' : 'Jugador'}</div>
          </div>
          
          ${temporadaData ? `
          <div class="temporada-info">
            Temporada: ${temporadaData.label || 'No especificada'}
          </div>
          ` : ''}
          
          <div class="section">
            <h3>Información del ${esPorrista ? 'Porrista' : 'Jugador'}</h3>
            <div class="info-row">
              <div class="info-label">Nombre:</div>
              <div class="info-value">${pagoData.nombre_jugador}</div>
            </div>
            ${pagoData.categoria ? `
            <div class="info-row">
              <div class="info-label">Categoría:</div>
              <div class="info-value">${pagoData.categoria}</div>
            </div>` : ''}
          </div>
          
          <div class="section">
            <h3>Detalles del Pago</h3>
            <div class="info-row">
              <div class="info-label">Concepto:</div>
              <div class="info-value">${formatTipoPago(pago.tipo)}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Monto:</div>
              <div class="info-value">$${safeToFixed(pago.monto)}</div>
            </div>
            ${pago.submonto > 0 ? `
            <div class="info-row">
              <div class="info-label">Submonto:</div>
              <div class="info-value">$${safeToFixed(pago.submonto)}</div>
            </div>` : ''}
            ${pago.fecha_limite ? `
            <div class="info-row">
              <div class="info-label">Fecha límite:</div>
              <div class="info-value">${pago.fecha_limite}</div>
            </div>` : ''}
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
            ${pago.beca && pago.beca !== "0" ? `
            <div class="info-row">
              <div class="info-label">Beca aplicada:</div>
              <div class="info-value">${pago.beca}%</div>
            </div>` : ''}
            ${pago.descuento && pago.descuento !== "0" ? `
            <div class="info-row">
              <div class="info-label">Descuento aplicado:</div>
              <div class="info-value">${pago.descuento}%</div>
            </div>` : ''}
            ${pago.abono === "SI" ? `
            <div class="info-row">
              <div class="info-label">Abonos:</div>
              <div class="info-value">$${safeToFixed(pago.total_abonado)} de $${safeToFixed(pago.monto)}</div>
            </div>` : ''}
            ${pago.metodo_pago ? `
            <div class="info-row"> 
              <div class="info-label">Método de pago:</div>
              <div class="info-value">${pago.metodo_pago}</div>
            </div>` : ''}
          </div>
          
          <div class="footer">
            Documento generado el ${formattedDate} - Club Toros © ${today.getFullYear()}
          </div>
        </body>
      </html>`;
  
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      } else {
        const { uri } = await Print.printToFileAsync({
          html,
          width: 612,
          height: 792,
        });
  
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Compartir comprobante',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('PDF generado', `Archivo guardado en: ${uri}`);
        }
      }
    } catch (error) {
      console.error('Error al generar el PDF:', error);
      Alert.alert('Error', 'No se pudo generar el comprobante');
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
      <View style={styles.mobileContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              Pagos de {pagoData.nombre_jugador}
            </Text>
          </View>

          {temporadaData && (
            <View style={styles.temporadaContainer}>
              <Text style={styles.temporadaText}>
                Temporada: {temporadaData.label}
              </Text>
            </View>
          )}

          <View style={styles.calendarWrapper}>
            <Calendar
              style={styles.calendar}
              markedDates={getMarkedDates()}
              markingType={"custom"}
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
                            alert(`Pago ${pago.estatus}\nTipo: ${formatTipoPago(pago.tipo)}\nMonto: $${pago.monto}\nFecha: ${pago.fecha_limite}`);
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
                {pagoData.nombre_jugador}
              </Text>
            </View>
            {pagoData.categoria && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Categoría:</Text>
                <Text style={styles.summaryValue}>
                  {pagoData.categoria}
                </Text>
              </View>
            )}
            {temporadaData && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Temporada:</Text>
                <Text style={styles.summaryValue}>
                  {temporadaData.label}
                </Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total:</Text>
              <Text style={styles.summaryValue}>
                ${safeToFixed(pagoData.monto_total)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pagado:</Text>
              <Text style={[styles.summaryValue, styles.paidAmount]}>
                ${safeToFixed(pagoData.monto_total_pagado)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pendiente:</Text>
              <Text style={[styles.summaryValue, styles.pendingAmount]}>
                ${safeToFixed(pagoData.monto_total_pendiente)}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Detalle de Pagos</Text>

          {pagoData.pagos.map((pago, index) => {
            const esCoaching = pago.tipo.toLowerCase().includes("coaching");
              let estatusMostrado = pago.estatus;

              if (esCoaching && pago.fecha_pago) {
                estatusMostrado = checkSemanaPago(pago.fecha_pago) ? "pendiente" : "Cubierto esta semana";
              } else {
                // Asegurarnos que el estado sea consistente con los abonos
                const totalAbonado = pago.total_abonado || 0;
                const montoPago = pago.monto || 0;
                estatusMostrado = totalAbonado >= montoPago ? pago.estatus : pago.estatus;
              }

            return (
              <View
                key={index}
                style={[
                  styles.paymentCard,
                  estatusMostrado === "pendiente"
                    ? styles.pendingCard
                    : styles.paidCard,
                ]}
              >
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentType}>{formatTipoPago(pago.tipo)}</Text>
                  <Text
                    style={[
                      styles.paymentStatus,
                      estatusMostrado === "pendiente"
                        ? styles.pendingText
                        : styles.paidText,
                    ]}
                  >
                    {estatusMostrado.toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.paymentAmount}>${safeToFixed(pago.monto)}</Text>

                {pago.abonos && pago.abonos.length > 0 && (
                  <View style={styles.abonosContainer}>
                    <Text style={styles.abonosTitle}>Detalle de abonos:</Text>
                    {pago.abonos.map((abono, abonoIndex) => (
                      <View key={abonoIndex} style={styles.abonoRow}>
                        {console.log(abono)}
                        <Text style={styles.abonoFecha}>{abono.fecha || 'Sin fecha'}:</Text>
                        <Text style={styles.abonoMonto}>${safeToFixed(abono.cantidad)}</Text>
                        {abono.metodo && (
                          <Text style={styles.abonoMetodo}>({abono.metodo})</Text>
                        )}
                      </View>
                    ))}
                    <View style={styles.abonoTotalRow}>
                      <Text style={styles.abonoTotalLabel}>Total abonado:</Text>
                      <Text style={styles.abonoTotalMonto}>${safeToFixed(pago.total_abonado || 0)}</Text>
                    </View>
                  </View>
                )}

                {pago.submonto > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Submonto:</Text>
                    <Text style={styles.detailValue}>${safeToFixed(pago.submonto)}</Text>
                  </View>
                )}

                {pago.fecha_limite && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fecha límite:</Text>
                    <Text style={styles.detailValue}>{pago.fecha_limite}</Text>
                  </View>
                )}

                {pago.fecha_pago && estatusMostrado === "pagado" && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fecha de pago:</Text>
                    <Text style={styles.detailValue}>{pago.fecha_pago}</Text>
                  </View>
                )}

                {(pago.beca && pago.beca !== "0") && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Beca aplicada:</Text>
                    <Text style={styles.detailValue}>{pago.beca}%</Text>
                  </View>
                )}

                {(pago.descuento && pago.descuento !== "0") && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Descuento aplicado:</Text>
                    <Text style={styles.detailValue}>{pago.descuento}%</Text>
                  </View>
                )}

                {pago.abono === "SI" && pago.abonos.length === 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Abonos:</Text>
                    <Text style={styles.detailValue}>
                      ${safeToFixed(pago.total_abonado)} de ${safeToFixed(pago.monto)}
                    </Text>
                  </View>
                )}

                {pago.metodo_pago && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Método de pago:</Text>
                    <Text style={styles.detailValue}>{pago.metodo_pago}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => generatePDF(pago)}
                >
                  <Text style={styles.downloadButtonText}>Generar recibo</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

// Estilos
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    width: "100%",
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
  temporadaContainer: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    alignItems: 'center',
  },
  temporadaText: {
    fontWeight: 'bold',
    color: '#0d47a1',
  },
  abonosContainer: {
    marginTop: 8,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  abonosTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#495057',
  },
  abonoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
    paddingLeft: 5,
  },
  abonoFecha: {
    fontSize: 12,
    color: '#6c757d',
  },
  abonoMonto: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#28a745',
  },
  abonoMetodo: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  abonoTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  abonoTotalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#212529',
  },
  abonoTotalMonto: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#007bff',
  },
});

export default PagosScreen;