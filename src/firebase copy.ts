// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuiIh0RY8Jk-JLPPaMrZ2tjclXpQ1DnQg",
  authDomain: "abc-proyect-fae46.firebaseapp.com",
  projectId: "abc-proyect-fae46",
  storageBucket: "abc-proyect-fae46.firebasestorage.app",
  messagingSenderId: "858058836581",
  appId: "1:858058836581:web:f5ce3978b4b7650fda948c",
  measurementId: "G-SVTNPFFKSV"
};

// Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);