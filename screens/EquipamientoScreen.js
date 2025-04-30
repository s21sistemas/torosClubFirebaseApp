import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const { width, height } = Dimensions.get('window');

const EquipamientoScreen = ({ route, navigation }) => {
  const [equipamiento, setEquipamiento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [asignados, setAsignados] = useState([]);
  const { jugadorId } = route.params;

  useEffect(() => {
    const fetchEquipamiento = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, 'equipamiento'), 
          where('jugadorId.value', '==', jugadorId)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data();
          setEquipamiento(docData);
          
          // Filtrar solo los items asignados
          const itemsAsignados = [
            { nombre: 'Jersey', asignado: docData.jersey, devuelto: null },
            { nombre: 'Short', asignado: docData.short, devuelto: null },
            { nombre: 'Leggings', asignado: docData.leggings, devuelto: null },
            { nombre: 'Uniforme de Entrenamiento', asignado: docData.uniforme_entrenamiento, devuelto: null },
            { nombre: 'Casco', asignado: docData.casco, devuelto: docData.devuelto },
            { nombre: 'Hombreras', asignado: docData.hombreras, devuelto: null },
            { nombre: 'Guardas', asignado: docData.guardas, devuelto: null }
          ].filter(item => item.asignado);
          
          setAsignados(itemsAsignados);
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

  const renderEquipoItem = ({ item }) => {
    return (
      <View style={styles.equipoItem}>
        <View style={styles.equipoInfo}>
          <Text style={styles.equipoName}>{item.nombre}</Text>
          {item.devuelto !== null && (
            <Text style={styles.devueltoText}>Devuelto: {item.devuelto}</Text>
          )}
        </View>
        <View style={styles.statusIndicator}>
          <Ionicons 
            name="checkmark-circle" 
            size={24} 
            color="#4CAF50" 
          />
          <Text style={styles.statusText}>ASIGNADO</Text>
        </View>
      </View>
    );
  };

  const renderSection = (title, items) => {
    const sectionItems = items.filter(item => item.asignado);
    
    if (sectionItems.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <FlatList
          data={sectionItems}
          renderItem={renderEquipoItem}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffbe00" />
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

  if (!equipamiento || asignados.length === 0) {
    return (
      <View style={styles.noDataContainer}>
        <Text style={styles.noDataText}>No hay equipamiento asignado registrado</Text>
      </View>
    );
  }

  const uniformeItems = [
    { nombre: 'Jersey', asignado: equipamiento.jersey },
    { nombre: 'Short', asignado: equipamiento.short },
    { nombre: 'Leggings', asignado: equipamiento.leggings },
    { nombre: 'Uniforme de Entrenamiento', asignado: equipamiento.uniforme_entrenamiento }
  ];

  const proteccionItems = [
    { nombre: 'Casco', asignado: equipamiento.casco, devuelto: equipamiento.devuelto },
    { nombre: 'Hombreras', asignado: equipamiento.hombreras },
    { nombre: 'Guardas', asignado: equipamiento.guardas }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>EQUIPAMIENTO ASIGNADO</Text>
          {equipamiento.numero && (
            <Text style={styles.playerNumber}>Número: {equipamiento.numero}</Text>
          )}
        </View>

        {renderSection('Uniforme', uniformeItems)}
        {renderSection('Protección', proteccionItems)}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total asignados:</Text>
            <Text style={[styles.summaryValue, styles.asignadoText]}>
              {asignados.length}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    padding: 20,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center'
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
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#ffbe00',
    marginBottom: 20,
    textAlign: 'center',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#777',
  },
  retryButton: {
    backgroundColor: '#ffbe00',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 5,
    elevation: 2,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: Platform.OS === 'ios' ? 0 : 20,
    zIndex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffbe00',
    marginBottom: 5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  playerNumber: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  statusText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#4CAF50',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
});

export default EquipamientoScreen;