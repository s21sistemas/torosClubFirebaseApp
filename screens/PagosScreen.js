import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; // Asegúrate de importar Firebase correctamente

const PagosScreen = () => {
  const [loading, setLoading] = useState(true);
  const [pagos, setPagos] = useState([]);
  const [error, setError] = useState(null);

  // Fechas marcadas en el calendario
  const markedDates = {
    '2023-10-15': {
      marked: true,
      dotColor: 'red',
      selected: true,
      selectedColor: '#FFD700', // Amarillo para destacar
      customStyles: {
        container: {
          backgroundColor: '#FFD700', // Fondo amarillo
          borderRadius: 5,
        },
        text: {
          color: 'black', // Texto en negro
          fontWeight: 'bold',
        },
      },
    },
  };

  // Obtener los pagos del usuario actual
  useEffect(() => {
    const fetchPagos = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('Usuario no autenticado.');
        }

        // Obtener los IDs de los documentos en jugadores y porristas que coincidan con el uid del usuario
        const qJugadores = query(collection(db, 'jugadores'), where('uid', '==', user.uid));
        const qPorristas = query(collection(db, 'porristas'), where('uid', '==', user.uid));

        const [jugadoresSnapshot, porristasSnapshot] = await Promise.all([
          getDocs(qJugadores),
          getDocs(qPorristas),
        ]);

        // Extraer los IDs de los documentos
        const jugadoresIds = jugadoresSnapshot.docs.map((doc) => doc.id);
        const porristasIds = porristasSnapshot.docs.map((doc) => doc.id);

        // Consultar pagos_jugador y pagos_porrista usando los IDs obtenidos
        const pagosJugadorPromises = jugadoresIds.map((id) =>
          getDocs(query(collection(db, 'pagos_jugador'), where('uid', '==', id)))
        );
        const pagosPorristaPromises = porristasIds.map((id) =>
          getDocs(query(collection(db, 'pagos_porrista'), where('uid', '==', id)))
        );

        const [pagosJugadorResults, pagosPorristaResults] = await Promise.all([
          Promise.all(pagosJugadorPromises),
          Promise.all(pagosPorristaPromises),
        ]);

        // Combinar los resultados
        const pagosData = [
          ...pagosJugadorResults.flatMap((snapshot) =>
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), tipo: 'jugador' }))
          ),
          ...pagosPorristaResults.flatMap((snapshot) =>
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), tipo: 'porrista' }))
          ),
        ];

        setPagos(pagosData);
      } catch (error) {
        console.error('Error al obtener los pagos:', error);
        setError('Error al cargar los pagos. Inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    fetchPagos();
  }, []);

  // Función para manejar la descarga de archivos
  const handleDownload = (url) => {
    Linking.openURL(url).catch(err => console.error("No se pudo abrir el enlace", err));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#ffbe00" />
        <Text style={styles.loadingText}>Cargando pagos...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => setLoading(true)}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Calendario */}
      <View style={styles.calendarContainer}>
        <Calendar
          style={styles.calendar}
          markedDates={markedDates}
          markingType={'custom'}
          theme={{
            calendarBackground: '#fff',
            selectedDayBackgroundColor: '#FFD700',
            selectedDayTextColor: '#000',
            todayTextColor: '#00adf5',
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
          }}
        />
      </View>

      {/* Mostrar los pagos */}
      {pagos.length > 0 ? (
        pagos.map((pago, index) => (
          <View key={index} style={[styles.card, pago.estado === 'pendiente' ? styles.pendingCard : styles.paidCard]}>
            <Text style={styles.cardTitle}>Pago de {pago.tipo === 'jugador' ? 'Jugador' : 'Porrista'}</Text>
            <Text style={styles.cardText}>Monto de inscripción: ${pago.monto_inscripcion}</Text>
            <Text style={styles.cardText}>Monto de túnel y botiquín: ${pago.monto_tunelYbotiquin}</Text>
            <Text style={styles.cardText}>Monto de coaching: ${pago.monto_couch}</Text>
            <Text style={styles.cardText}>Fecha de pago: {pago.fechaPagoInscripcion?.toDate().toLocaleDateString()}</Text>
            <Text style={styles.cardText}>Estado: <Text style={pago.estado === 'pendiente' ? styles.pendingText : styles.paidText}>{pago.estado}</Text></Text>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => handleDownload('https://ejemplo.com/formato-inscripcion.pdf')}
            >
              <Text style={styles.downloadButtonText}>Descargar formato de pago</Text>
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <Text style={styles.noDataText}>No hay pagos registrados.</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  calendarContainer: {
    width: '100%',
    marginBottom: 20,
  },
  calendar: {
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    height: 300,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pendingCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#FF6347', // Rojo para pendiente
  },
  paidCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#32CD32', // Verde para pagado
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  cardText: {
    fontSize: 16,
    marginBottom: 5,
  },
  pendingText: {
    color: '#FF6347', // Rojo para pendiente
    fontWeight: 'bold',
  },
  paidText: {
    color: '#32CD32', // Verde para pagado
    fontWeight: 'bold',
  },
  downloadButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ffbe00',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#777',
    marginTop: 20,
  },
});

export default PagosScreen;