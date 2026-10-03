import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from 'firebase/auth'
import { deleteDoc, getDocs, writeBatch } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import { clearKeyLocally } from './crypto'
import { userCollection, userDoc } from './data/references'

const LEGACY_UIDS = new Set(['3tVQFbLCRdYaU7KWFCETsC9dojD3', 'y9U4soXK8neWBJaq4MuNjZFsEAi2'])
const COLLECTIONS = ['transactions', 'categories', 'accounts']

export async function deleteCurrentAccount({ password, confirm }) {
  const user = auth.currentUser
  if (!user || !confirm) throw new Error('Suppression annulée.')
  if (LEGACY_UIDS.has(user.uid)) throw new Error('Ce compte historique est protégé. Utilise le nouveau compte V2 pour une suppression complète.')
  if (user.providerData.some(provider => provider.providerId === 'password')) {
    if (!password) throw new Error('Saisis ton mot de passe pour confirmer la suppression.')
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
  } else await reauthenticateWithPopup(user, googleProvider)
  for (const name of COLLECTIONS) {
    const snapshot = await getDocs(userCollection(user.uid, name))
    for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
      const batch = writeBatch(db)
      snapshot.docs.slice(offset, offset + 400).forEach(document => batch.delete(document.ref))
      await batch.commit()
    }
  }
  for (const id of ['dashboard', 'crypto', 'verif']) await deleteDoc(userDoc(user.uid, 'config', id)).catch(() => {})
  clearKeyLocally(user.uid)
  await deleteUser(user)
}
