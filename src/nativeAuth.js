import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase'

export async function loginGoogle() {
  if (!Capacitor.isNativePlatform()) return signInWithPopup(auth, googleProvider)
  if (import.meta.env.VITE_ANDROID_CONFIGURED !== 'true') throw new Error('Cette préversion Android attend sa configuration Firebase pour la connexion Google.')
  const result = await FirebaseAuthentication.signInWithGoogle()
  if (!result.credential?.idToken) throw new Error('Google n’a pas fourni de jeton de connexion.')
  return signInWithCredential(auth, GoogleAuthProvider.credential(result.credential.idToken))
}
export async function logoutGoogle() {
  await signOut(auth)
  if (Capacitor.isNativePlatform() && import.meta.env.VITE_ANDROID_CONFIGURED === 'true') await FirebaseAuthentication.signOut()
}
