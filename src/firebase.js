import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCv0O8yCEC0FCdZ_6gDejrRGmY5ddIWghU",
  authDomain: "comptes-44440.firebaseapp.com",
  projectId: "comptes-44440",
  storageBucket: "comptes-44440.firebasestorage.app",
  messagingSenderId: "1020740321083",
  appId: "1:1020740321083:web:81a5d2b0cd4ef316ec811e"
};

const useProduction = import.meta.env.VITE_V2_USE_PRODUCTION === 'true';
const app = initializeApp(useProduction ? firebaseConfig : { ...firebaseConfig, projectId: 'demo-mes-comptes-v2' });
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// V2 preview defaults to local emulators. Production requires an explicit build opt-in.
if (!useProduction) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
}
