import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const EquipamientoScreen = ({ route }) => {
  const [equipamiento, setEquipamiento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { jugadorId } = route.params;

  useEffect(() => {
    const fetchEquipamiento = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, 'equipamiento'), 
          where('id', '==', '05UYa7z4eGbUXyYgZxpC') //hardcode al id  para que nos muestre la colección de ejemplo 
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data();
          setEquipamiento(docData);
        } else {
          setError('No se encontró registro de equipamiento');
        }
      } catch (err) {
        console.error('Error al obtener equipamiento:', err);
        setError('Error al cargar el equipamiento');
      } finally {
        setLoading(false);
      }
    };

    fetchEquipamiento();
  }, [jugadorId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E1251B" />
        <Text style={styles.loadingText}>Cargando equipamiento...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => setLoading(true)}
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!equipamiento) {
    return (
      <View style={styles.noDataContainer}>
        <Text style={styles.noDataText}>No hay datos de equipamiento registrados</Text>
      </View>
    );
  }

  const renderEquipoItem = (nombre, asignado, devuelto = null) => {
    return (
      <View style={styles.equipoItem}>
        <View style={styles.equipoInfo}>
          <Text style={styles.equipoName}>{nombre}</Text>
          {devuelto !== null && (
            <Text style={styles.devueltoText}>Devuelto: {devuelto}</Text>
          )}
        </View>
        <View style={[
          styles.statusIndicator, 
          asignado ? styles.asignado : styles.noAsignado
        ]}>
          <Ionicons 
            name={asignado ? 'checkmark-circle' : 'close-circle'} 
            size={24} 
            color={asignado ? '#4CAF50' : '#ffbe00'} 
          />
          <Text style={styles.statusText}>
            {asignado ? 'ASIGNADO' : 'NO ASIGNADO'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>EQUIPAMIENTO</Text>
          {equipamiento.numero && (
            <Text style={styles.playerNumber}>Número: {equipamiento.numero}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uniforme</Text>
          {renderEquipoItem('Jersey', equipamiento.jersey)}
          {renderEquipoItem('Short', equipamiento.short)}
          {renderEquipoItem('Leggings', equipamiento.leggings)}
          {renderEquipoItem('Uniforme de Entrenamiento', equipamiento.uniforme_entrenamiento)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Protección</Text>
          {renderEquipoItem('Casco', equipamiento.casco, equipamiento.devuelto)}
          {renderEquipoItem('Hombreras', equipamiento.hombreras)}
          {renderEquipoItem('Guardas', equipamiento.guardas)}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total items:</Text>
            <Text style={styles.summaryValue}>8</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Asignados:</Text>
            <Text style={[styles.summaryValue, styles.asignadoText]}>
              {Object.values(equipamiento).filter(val => val === true).length}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Faltantes:</Text>
            <Text style={[styles.summaryValue, styles.noAsignadoText]}>
              {Object.values(equipamiento).filter(val => val === false).length - 1} 
              {/* Restamos 1 por el campo 'id' */}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#E1251B',
    marginBottom: 20,
    textAlign: 'center',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#777',
  },
  retryButton: {
    backgroundColor: '#E1251B',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    marginBottom: 15,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E1251B',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  playerNumber: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  equipoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  equipoInfo: {
    flex: 1,
  },
  equipoName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  devueltoText: {
    fontSize: 12,
    color: '#777',
    marginTop: 3,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  asignado: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  noAsignado: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  statusText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#555',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  asignadoText: {
    color: '#4CAF50',
  },
  noAsignadoText: {
    color: '#ffbe00',
  },
});

export default EquipamientoScreen;