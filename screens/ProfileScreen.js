import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const formatValue = (value) => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'object') {
    return value.tipo || value.nombre || JSON.stringify(value);
  }
  return String(value);
};

const CustomImage = ({ uri, style }) => {
  const [imageError, setImageError] = useState(false);

  if (imageError || !uri) {
    return (
      <View style={[styles.cardImage, styles.imagePlaceholder]}>
        <Ionicons name="person" size={40} color="#ccc" />
      </View>
    );
  }

  return (
    <Image 
      source={{ uri }} 
      style={style}
      onError={() => setImageError(true)}
    />
  );
};

const ProfileScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [players, setPlayers] = useState([]);
  const [cheerleaders, setCheerleaders] = useState([]);
  const [loginData, setLoginData] = useState({
    correo: '',
    id: '',
    nombre_completo: '',
    ocupacion: '',
    rol: '',
  });

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    const fetchUserData = async () => {
      try {
        const q = query(collection(db, 'usuarios'), where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          setLoginData({
            correo: user.email,
            id: user.uid,
            nombre_completo: userData.nombre_completo || 'Usuario',
            ocupacion: userData.ocupacion || '',
            rol: userData.rol || '',
          });
        } else {
          setError('No se encontraron datos adicionales del usuario.');
        }
      } catch (error) {
        console.error('Error al obtener los datos del usuario:', error);
        setError('Error al cargar los datos del usuario.');
      }
    };

    if (user) {
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loginData.id) {
      const fetchPlayersAndCheerleaders = async () => {
        try {
          const qPlayers = query(
            collection(db, 'jugadores'), 
            where('uid', '==', loginData.id),
            where('activo', '==', 'activo')
          );
          
          const qCheerleaders = query(
            collection(db, 'porristas'), 
            where('uid', '==', loginData.id),
            where('activo', '==', 'activo')
          );

          const [playersSnapshot, cheerleadersSnapshot] = await Promise.all([
            getDocs(qPlayers),
            getDocs(qCheerleaders),
          ]);

          const playersData = playersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          const cheerleadersData = cheerleadersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          setPlayers(playersData);
          setCheerleaders(cheerleadersData);
        } catch (error) {
          console.error('Error al obtener los registros:', error);
          setError('Error al cargar los registros. Inténtalo de nuevo.');
        } finally {
          setLoading(false);
        }
      };

      fetchPlayersAndCheerleaders();
    }
  }, [loginData.id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#b51f28" />
        <Text style={styles.loadingText}>Cargando datos del usuario...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.profileButton} 
          onPress={() => setShowMenu(!showMenu)}
        >
          <View style={styles.profileContent}>
            <Text style={styles.headerText}>Hola, {formatValue(loginData.nombre_completo)}</Text>
            <Ionicons name="person-circle" size={32} color="#333" />
          </View>
        </TouchableOpacity>

        {showMenu && (
          <View style={styles.menuContainer}>
            <View style={styles.menu}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('EditarPerfil');
                }}
              >
                <Text style={styles.menuText}>Editar Perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  auth.signOut();
                  navigation.navigate('Login');
                }}
              >
                <Text style={styles.menuText}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <ScrollView style={styles.mainContent}>
        <Text style={styles.sectionTitle}>Jugadores Registrados</Text>
        {players.length > 0 ? (
          players.map((player, index) => (
            <View key={`player-${player.id || index}`} style={styles.card}>
              <View style={styles.cardLeft}>
                <CustomImage uri={player.foto} style={styles.cardImage} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>
                    {formatValue(player.nombre)} {formatValue(player.apellido_p)} {formatValue(player.apellido_m)}
                  </Text>
                  <Text style={styles.cardDetail}>Tipo: {formatValue(player.tipo_inscripcion)}</Text>
                  <Text style={styles.cardDetail}>MFL: {formatValue(player.numero_mfl)}</Text>
                  <Text style={styles.cardDetail}>Categoría: {formatValue(player.categoria)}</Text>
                </View>
              </View>
              <View style={styles.cardButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.pagosButton]}
                  onPress={() => navigation.navigate('Pagos', { jugadorId: player.id })}
                >
                  <Text style={styles.buttonText}>Pagos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.equipmentButton]}
                  onPress={() => navigation.navigate('Equipamiento', { jugadorId: player.id })}
                >
                  <Text style={styles.buttonText}>Equipamiento</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No hay jugadores activos registrados.</Text>
        )}

        <Text style={styles.sectionTitle}>Porristas Registradas</Text>
        {cheerleaders.length > 0 ? (
          cheerleaders.map((cheerleader, index) => (
            <View key={`cheerleader-${cheerleader.id || index}`} style={styles.card}>
              <View style={styles.cardLeft}>
                <CustomImage uri={cheerleader.foto} style={styles.cardImage} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>
                    {formatValue(cheerleader.nombre)} {formatValue(cheerleader.apellido_p)} {formatValue(cheerleader.apellido_m)}
                  </Text>
                  <Text style={styles.cardDetail}>Tipo: {formatValue(cheerleader.tipo_inscripcion)}</Text>
                  <Text style={styles.cardDetail}>MFL: {formatValue(cheerleader.numero_mfl)}</Text>
                  <Text style={styles.cardDetail}>Categoría: {formatValue(cheerleader.categoria)}</Text>
                </View>
              </View>
              <View style={styles.cardButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.pagosButton]}
                onPress={() => navigation.navigate('Pagos', { 
                  jugadorId: cheerleader.id,
                  esPorrista: true 
                })}
              >
                <Text style={styles.buttonText}>Ver Pagos</Text>
              </TouchableOpacity>
                {/*<TouchableOpacity
                  style={[styles.actionButton, styles.equipmentButton]}
                  onPress={() => navigation.navigate('Equipamiento', { jugadorId: cheerleader.id })}
                >
                  <Text style={styles.buttonText}>Ver Equipamiento</Text>
                </TouchableOpacity>*/}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No hay porristas activas registradas.</Text>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('HomeScreen')}
      >
        <View style={styles.addButtonContent}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Registrar</Text>
        </View>
      </TouchableOpacity>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setLoading(true)}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 5,
  },
  headerContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
    zIndex: 100,
    paddingLeft: 10,
    paddingRight: 10,
  },
  profileButton: {
    width: '100%',
  },
  profileContent: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  menuContainer: {
    position: 'absolute',
    top: 40,
    right: 0,
    zIndex: 1000,
  },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 150,
  },
  menuItem: {
    padding: 10,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
  },
  mainContent: {
    flex: 1,
    zIndex: 1,
    paddingLeft: 10,
    paddingRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 15,
    color: '#333',
    textAlign: 'left',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 15,
  },
  imagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    numberOfLines: 2, // Limita a 2 líneas
    ellipsizeMode: 'tail',
    width:'60%',
  },
  cardDetail: {
    fontSize: 12,
    color: '#555',
    marginBottom: 3,
  },
  cardButtons: {
    marginLeft: 10,
    alignItems: 'flex-end',
    width: '25%',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginBottom: 8,
    minWidth: 120,
    width: '100%',
    alignItems: 'center',
  },
  pagosButton: {
    backgroundColor: '#b51f28',
  },
  equipmentButton: {
    backgroundColor: '#2c3e50',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#777',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#b51f28',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 100,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#b51f28',
    padding: 12,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});

export default ProfileScreen;