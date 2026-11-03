import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, persistentSingleTabManager, connectFirestoreEmulator, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { getAuth, GoogleAuthProvider, connectAuthEmulator, reload } from "firebase/auth";
import { limitStartupAuthRequests } from './data/startupAuth';

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
// Keep the complete encrypted Firestore cache on the device. Firestore queues
// writes while offline and flushes them automatically when connectivity returns.
// The Android app has a single WebView: take ownership of the cache directly
// instead of negotiating a multi-tab lease with a possibly dead previous process.
// The website keeps multi-tab support.
const tabManager = Capacitor.isNativePlatform()
  ? persistentSingleTabManager({ forceOwnership: true })
  : persistentMultipleTabManager();
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager, cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
});
const restoreFetch = limitStartupAuthRequests(firebaseConfig.apiKey, useProduction ? undefined : 'http://127.0.0.1:9099');
export const auth = getAuth(app);
auth.authStateReady().then(() => {
  restoreFetch();
  // Server validation continues after the local interface has had time to open.
  const refresh = () => {
    if (navigator.onLine && auth.currentUser) reload(auth.currentUser).catch(() => { /* The SDK handles invalid sessions; network failures keep the local user. */ });
  };
  setTimeout(refresh, 2000);
  window.addEventListener('online', refresh);
}, restoreFetch);
auth.languageCode = "fr";
export const googleProvider = new GoogleAuthProvider();

// V2 preview defaults to local emulators. Production requires an explicit build opt-in.
if (!useProduction) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
}
