import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, browserLocalPersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC7X0-FNbdjpvriSxihbfyeLyTRNytu4vo",
  authDomain: "clubtoros-c8a29.firebaseapp.com",
  projectId: "clubtoros-c8a29",
  storageBucket: "clubtoros-c8a29.firebasestorage.app",
  messagingSenderId: "846887347766",
  appId: "1:846887347766:web:bff3f8f43645b6ac0c5a97",
  measurementId: "G-5S51N7ED37"
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