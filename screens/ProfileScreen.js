import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig'; // Importa Firebase Auth y Firestore (db)
import { collection, query, where, getDocs } from 'firebase/firestore'; // Importa las funciones de Firestore

const ProfileScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [players, setPlayers] = useState([]);
  const [loginData, setLoginData] = useState({
    correo: '',
    id: '',
    nombre_completo: '',
    ocupacion: '',
    rol: '',
  });

  // Obtener datos del usuario autenticado
  useEffect(() => {
    const user = auth.currentUser;

    if (user) {
      setLoginData({
        correo: user.email,
        id: user.uid,
        nombre_completo: user.displayName || 'Usuario',
        ocupacion: '',
        rol: '',
      });
      console.log(loginData);
    } else {
      setError('No hay un usuario autenticado.');
    }

    // Obtener los jugadores asociados al usuario desde Firestore
    const fetchPlayers = async () => {
      try {
        const q = query(collection(db, 'jugadores'));
        const querySnapshot = await getDocs(q);

        const playersData = [];
        querySnapshot.forEach((doc) => {
          playersData.push({ id: doc.id, ...doc.data() });
        });

        setPlayers(playersData);
      } catch (error) {
        console.error('Error al obtener los jugadores:', error);
        setError('Error al cargar los jugadores. Inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchPlayers();
    } else {
      setLoading(false);
    }
  }, []);

  // Si está cargando, muestra un indicador de carga
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FBBE08" />
        <Text>Cargando datos del usuario...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Encabezado con nombre de usuario y ícono */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Hola {loginData.nombre_completo}</Text>
        <TouchableOpacity onPress={() => setShowMenu(!showMenu)}>
          <Ionicons name="person-circle" size={32} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Menú desplegable */}
      {showMenu && (
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
              auth.signOut(); // Cerrar sesión en Firebase Auth
              navigation.navigate('Login');
            }}
          >
            <Text style={styles.menuText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Título "Jugadores Registrados" */}
      <Text style={styles.sectionTitle}>Jugadores Registrados</Text>

      {/* Lista de jugadores */}
      <ScrollView style={styles.scrollView}>
        {players.length > 0 ? (
          players.map((player, index) => (
            <View key={index} style={styles.card}>
              <Image source={{ uri: player.foto_jugador }} style={styles.cardImage} />
              <View style={styles.cardContent}>
                <Text style={styles.cardText}>
                  {player.nombre} {player.apellido_p} {player.apellido_m}
                </Text>
                <Text style={styles.cardText}>CURP: {player.curp}</Text>
                <Text style={styles.cardText}>Teléfono: {player.telefono}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noPlayersText}>No hay jugadores registrados.</Text>
        )}
      </ScrollView>

      {/* Botón redondo para registrar otro jugador */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('HomeScreen')} // Cambiado de 'Home' a 'HomeScreen'
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Mostrar mensaje de error si existe */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={() => setLoading(true)}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  menu: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    zIndex: 1,
  },
  menuItem: {
    padding: 10,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  cardContent: {
    justifyContent: 'center',
  },
  cardText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 5,
  },
  noPlayersText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#777',
    marginTop: 20,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#FBBE08',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#FBBE08',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ProfileScreen;