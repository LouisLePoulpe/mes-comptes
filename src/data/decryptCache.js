// Decrypting the whole history is the main cost of opening the app. Firestore
// delivers the same documents several times at startup (explicit cache read,
// first listener snapshot, then server confirmation), so each ciphertext is
// decrypted once and the resulting row is reused as long as it is unchanged.
export function createRowDecryptor(decryptDocument) {
  const entries = new Map()
  return {
    // Returns a promise of the decrypted row. A pending decryption is shared by
    // concurrent snapshots, and a changed ciphertext (new iv/data) is decrypted again.
    row(id, encrypted) {
      const known = entries.get(id)
      if (known && known.iv === encrypted.iv && known.data === encrypted.data) return known.promise
      const promise = Promise.resolve(decryptDocument(encrypted)).then(plain => ({ ...plain, id }))
      entries.set(id, { iv: encrypted.iv, data: encrypted.data, promise })
      return promise
    },
    // Forget documents that disappeared from the collection.
    retain(ids) {
      for (const id of entries.keys()) if (!ids.has(id)) entries.delete(id)
    },
  }
}

// Keep the previous array when a snapshot brought no actual change (for example
// only metadata: cache -> server). Consumers then skip their expensive recomputation.
export function reuseRows(previous, next) {
  if (!previous || previous.length !== next.length) return next
  return previous.every((row, index) => row === next[index]) ? previous : next
}
