// Let Vite resolve the same SDK instance as the app's DocumentReferences.
// Unlike data/offline.setDoc, this promise waits for server acknowledgement.
export { setDoc } from 'firebase/firestore'
