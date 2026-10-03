import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from 'firebase/auth'
import { getDocsFromServer, writeBatch } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import { clearKeyLocally } from './crypto'
import { userCollection } from './data/references'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { GoogleAuthProvider } from 'firebase/auth'

const LEGACY_UIDS = new Set(['3tVQFbLCRdYaU7KWFCETsC9dojD3', 'y9U4soXK8neWBJaq4MuNjZFsEAi2'])
const COLLECTIONS = ['transactions', 'categories', 'accounts', 'config']
export const deletionPending = uid => localStorage.getItem('poulpecule-deleting:' + uid) === 'true'

export async function deleteCurrentAccount({ password, confirm }) {
  const user = auth.currentUser
  if (!user || !confirm) throw new Error('Suppression annulée.')
  if (LEGACY_UIDS.has(user.uid)) throw new Error('Ce compte historique est protégé. Utilise le nouveau compte V2 pour une suppression complète.')
  if (user.providerData.some(provider => provider.providerId === 'password')) {
    if (!password) throw new Error('Saisis ton mot de passe pour confirmer la suppression.')
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
  } else if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_ANDROID_CONFIGURED !== 'true') throw new Error('Reconnecte-toi sur le site pour confirmer la suppression avec Google.')
    const result = await FirebaseAuthentication.signInWithGoogle()
    if (!result.credential?.idToken) throw new Error('Connexion Google interrompue.')
    await reauthenticateWithCredential(user, GoogleAuthProvider.credential(result.credential.idToken))
  } else await reauthenticateWithPopup(user, googleProvider)
  localStorage.setItem('poulpecule-deleting:' + user.uid, 'true')
  for (const name of COLLECTIONS) {
    if (auth.currentUser?.uid !== user.uid) throw new Error('La connexion a changé. Suppression interrompue.')
    const snapshot = await getDocsFromServer(userCollection(user.uid, name))
    for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
      const batch = writeBatch(db)
      snapshot.docs.slice(offset, offset + 400).forEach(document => batch.delete(document.ref))
      await batch.commit()
    }
  }
  for (const name of COLLECTIONS) {
    if (!(await getDocsFromServer(userCollection(user.uid, name))).empty) throw new Error('Des données ont été ajoutées depuis un autre appareil. Ferme les autres sessions puis réessaie.')
  }
  await deleteUser(user)
  clearKeyLocally(user.uid)
  localStorage.removeItem('poulpecule-deleting:' + user.uid)
}
