import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, browserLocalPersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAtGUX2LG4Ua6IQO1Cf9PuMP4GkZ80RA50",
  authDomain: "toros-1453e.firebaseapp.com",
  projectId: "toros-1453e",
  storageBucket: "toros-1453e.firebasestorage.app",
  messagingSenderId: "898581498892",
  appId: "1:898581498892:web:48e49c9bd5a0e15ed8f229"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Configuración de Auth con persistencia multiplataforma
const auth = initializeAuth(app, {
  persistence: typeof window === 'undefined' 
    ? getReactNativePersistence(AsyncStorage) 
    : browserLocalPersistence
});

// Configuración de Firestore
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

export { app, auth, db };