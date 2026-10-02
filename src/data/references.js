import { collection, doc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { userPath } from './paths'

export function userCollection(uid, name) {
  if (auth.currentUser?.uid !== uid) throw new Error('Session expirée')
  return collection(db, ...userPath(uid, name))
}
export function userDoc(uid, name, id) {
  if (auth.currentUser?.uid !== uid) throw new Error('Session expirée')
  return doc(db, ...userPath(uid, name, id))
}
