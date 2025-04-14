import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, browserLocalPersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCepGR5AoV8rVcay5Y-T4KItOJ-YqRRKLk",
  authDomain: "clubpotros-f28a5.firebaseapp.com",
  projectId: "clubpotros-f28a5",
  storageBucket: "clubpotros-f28a5.firebasestorage.app",
  messagingSenderId: "650568328185",
  appId: "1:650568328185:web:f9c5283d502df85d7ad328",
  measurementId: "G-LDX9FQH6ED"
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