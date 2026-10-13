
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "fresherai-c5a28.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "fresherai-c5a28",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "fresherai-c5a28.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "794195152704",
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app)

const provider = new GoogleAuthProvider()

export {auth , provider}