import { doc, getDoc, getDocFromCache, onSnapshot, setDoc as firestoreSet, updateDoc as firestoreUpdate, deleteDoc as firestoreDelete } from 'firebase/firestore'

// Never interpret a missing offline cache as a new/empty vault.
export async function getVaultDoc(ref) {
  const snapshot = navigator.onLine ? await getDoc(ref) : await getDocFromCache(ref)
  if (!snapshot.exists() && snapshot.metadata.fromCache) {
    throw new Error('Connecte cet appareil une première fois pour télécharger ton coffre.')
  }
  return snapshot
}

// Resolve after Firestore has applied the mutation to its persistent local store,
// rather than waiting for the server acknowledgement (which can take days).
// A later server rejection must remain visible, even after leaving the form.
function locallyAccepted(ref, write) {
  return new Promise((resolve, reject) => {
    let accepted = false
    let stop = () => {}
    const finish = () => { accepted = true; stop(); resolve(ref) }
    let started = false
    stop = onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
      if (!started) {
        started = true
        // Start only after the initial snapshot, so an older pending mutation
        // cannot accidentally acknowledge this new mutation.
        write().then(finish, error => {
          stop()
          if (accepted) window.dispatchEvent(new CustomEvent('poulpecule-sync-error', { detail: error.code }))
          else reject(error)
        })
      } else if (snapshot.metadata.hasPendingWrites) finish()
    }, error => { stop(); reject(error) })
  })
}

export const setDoc = (ref, data) => locallyAccepted(ref, () => firestoreSet(ref, data))
export const updateDoc = (ref, data) => locallyAccepted(ref, () => firestoreUpdate(ref, data))
export const deleteDoc = ref => locallyAccepted(ref, () => firestoreDelete(ref))
export const addDoc = (collection, data) => setDoc(doc(collection), data)
