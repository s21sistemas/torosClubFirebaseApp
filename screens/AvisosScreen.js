import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity, 
  Animated, 
  Alert,
  TouchableWithoutFeedback
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton } from 'react-native-gesture-handler';

const AvisosScreen = ({ navigation }) => {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const swipeableRefs = useRef({});

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      if (user) {
        fetchAvisos(user.uid);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const fetchAvisos = (userId) => {
    const q = query(
      collection(db, 'alertas'),
      where('tutor_id', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const avisosData = [];
      querySnapshot.forEach((doc) => {
        avisosData.push({ id: doc.id, ...doc.data() });
      });
      setAvisos(avisosData);
      setLoading(false);
    });

    return unsubscribe;
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Eliminar Aviso',
      '¿Estás seguro de que deseas eliminar este aviso?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            // Cerrar el Swipeable al cancelar
            if (swipeableRefs.current[id]) {
              swipeableRefs.current[id].close();
            }
          }
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteAviso(id)
        }
      ]
    );
  };

  const deleteAviso = async (id) => {
    try {
      await deleteDoc(doc(db, 'alertas', id));
      // No necesitamos actualizar el estado manualmente porque onSnapshot lo hará automáticamente
    } catch (error) {
      console.error('Error al eliminar aviso:', error);
      Alert.alert('Error', 'No se pudo eliminar el aviso');
    }
  };

  const renderRightActions = (progress, dragX, id) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.9],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <RectButton
          style={styles.deleteButton}
          onPress={() => handleDelete(id)}
        >
          <Ionicons name="trash" size={24} color="white" />
          <Text style={styles.deleteButtonText}>Eliminar</Text>
        </RectButton>
      </Animated.View>
    );
  };

  const renderItem = ({ item, index }) => (
    <Swipeable
      ref={(ref) => (swipeableRefs.current[item.id] = ref)}
      friction={2}
      rightThreshold={40}
      renderRightActions={(progress, dragX) => 
        renderRightActions(progress, dragX, item.id)
      }
      onSwipeableOpen={() => {
        // Cerrar otros Swipeables abiertos
        Object.keys(swipeableRefs.current).forEach(key => {
          if (key !== item.id && swipeableRefs.current[key]) {
            swipeableRefs.current[key].close();
          }
        });
      }}
    >
      <Animated.View 
        style={[
          styles.avisoCard,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            }],
          },
        ]}
      >
        <View style={styles.avisoHeader}>
          <View style={styles.avisoIcon}>
            <Ionicons 
              name={item.estatus === 'pendiente' ? 'alert-circle' : 'checkmark-circle'} 
              size={24} 
              color={item.estatus === 'pendiente' ? '#FFC107' : '#4CAF50'} 
            />
          </View>
          <Text style={styles.avisoAsunto}>{item.asunto}</Text>
        </View>
        
        <Text style={styles.avisoMensaje}>{item.mensaje}</Text>
        
        <View style={styles.avisoFooter}>
          <View style={styles.tag}>
            <Ionicons name="calendar" size={14} color="#666" />
            <Text style={styles.avisoFecha}>{item.fecha}</Text>
          </View>
          <View style={[
            styles.statusTag,
            item.estatus === 'pendiente' ? styles.pendingTag : styles.completedTag
          ]}>
            <Text style={styles.avisoEstatus}>
              {item.estatus.toUpperCase()}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Swipeable>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#b51f28" />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No has iniciado sesión</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Avisos</Text>
        <View style={{ width: 24 }} />
      </View>

      {avisos.length === 0 ? (
        <Animated.View 
          style={[
            styles.emptyContainer,
            { opacity: fadeAnim }
          ]}
        >
          <Ionicons name="notifications-off" size={48} color="#b51f28" />
          <Text style={styles.noAvisosText}>No tienes avisos pendientes</Text>
          <Text style={styles.noAvisosSubtext}>Cuando tengas notificaciones, aparecerán aquí</Text>
        </Animated.View>
      ) : (
        <FlatList
          data={avisos}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  header: {
    backgroundColor: '#b51f28',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noAvisosText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  noAvisosSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  avisoCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#b51f28',
  },
  avisoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avisoIcon: {
    marginRight: 12,
  },
  avisoAsunto: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  avisoMensaje: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
  },
  avisoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pendingTag: {
    backgroundColor: '#FFF3CD',
  },
  completedTag: {
    backgroundColor: '#D4EDDA',
  },
  avisoFecha: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  avisoEstatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  text: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  deleteButton: {
    backgroundColor: '#b51f28',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 12,
    marginLeft: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    fontWeight: 'bold',
  },
});

export default AvisosScreen;