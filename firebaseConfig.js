import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyAxQEbSBtaSwO76yNhHpGst63jWZkqkzxE",
  authDomain: "potros-632ee.firebaseapp.com",
  projectId: "potros-632ee",
  storageBucket: "potros-632ee.firebasestorage.app",
  messagingSenderId: "715399204517",
  appId: "1:715399204517:web:6f82c57e723c47931b074c"
};

// Inicializar Firebase b51f28
const app = initializeApp(firebaseConfig);

// Auth sin persistencia personalizada (compatible con Expo Go)
const auth = getAuth(app);

// Firestore
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

export { app, auth, db };
