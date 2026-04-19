import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCv0O8yCEC0FCdZ_6gDejrRGmY5ddIWghU",
  authDomain: "comptes-44440.firebaseapp.com",
  projectId: "comptes-44440",
  storageBucket: "comptes-44440.firebasestorage.app",
  messagingSenderId: "1020740321083",
  appId: "1:1020740321083:web:81a5d2b0cd4ef316ec811e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Mode offline
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Offline persistence: plusieurs onglets ouverts")
  } else if (err.code === "unimplemented") {
    console.warn("Offline persistence: non supporté par ce navigateur")
  }
});