import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAtGUX2LG4Ua6IQO1Cf9PuMP4GkZ80RA50",
  authDomain: "toros-1453e.firebaseapp.com",
  projectId: "toros-1453e",
  storageBucket: "toros-1453e.appspot.com",
  messagingSenderId: "898581498892",
  appId: "1:898581498892:web:48e49c9bd5a0e15ed8f229"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Auth sin persistencia personalizada (compatible con Expo Go)
const auth = getAuth(app);

// Firestore
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

export { app, auth, db };
