import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyC7X0-FNbdjpvriSxihbfyeLyTRNytu4vo",
    authDomain: "clubtoros-c8a29.firebaseapp.com",
    projectId: "clubtoros-c8a29",
    storageBucket: "clubtoros-c8a29.firebasestorage.app",
    messagingSenderId: "846887347766",
    appId: "1:846887347766:web:bff3f8f43645b6ac0c5a97",
    measurementId: "G-5S51N7ED37"
  };

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export { firebase };