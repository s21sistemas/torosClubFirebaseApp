
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC7X0-FNbdjpvriSxihbfyeLyTRNytu4vo",
  authDomain: "clubtoros-c8a29.firebaseapp.com",
  projectId: "clubtoros-c8a29",
  storageBucket: "clubtoros-c8a29.firebasestorage.app",
  messagingSenderId: "846887347766",
  appId: "1:846887347766:web:bff3f8f43645b6ac0c5a97",
  measurementId: "G-5S51N7ED37"
};

const app = initializeApp(firebaseConfig);


// Verifica si ya hay una instancia de Firebase antes de inicializarla

// Inicializa Firestore con opciones avanzadas
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Fuerza el uso de long polling en redes restringidas
  useFetchStreams: false, // Desactiva fetch para evitar problemas en Expo
});
// Configura Firebase Auth dependiendo de la plataforma
let auth;
if (typeof window === 'undefined') {
  // Entorno de React Native
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} else {
  // Entorno Web
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
}

export { app, auth, db };

