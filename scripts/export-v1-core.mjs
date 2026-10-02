import { open } from 'node:fs/promises'

// Refuse Firestore-specific types instead of silently corrupting an archive.
function assertJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (Array.isArray(value)) { value.forEach(assertJson); return }
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    Object.values(value).forEach(assertJson)
    return
  }
  throw new Error('Unsupported Firestore value: archive cancelled; no data converted')
}

export async function readV1Archive(db) {
  // One read-only transaction supplies a consistent snapshot across collections.
  return db.runTransaction(async transaction => {
    const archive = {}
    for (const name of ['config', 'transactions', 'categories']) {
      const snapshot = await transaction.get(db.collection(name))
      archive[name] = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
    }
    assertJson(archive)
    if (!archive.config.some(row => row.id === 'crypto') || !archive.config.some(row => row.id === 'verif')) {
      throw new Error('Missing V1 encryption configuration; archive cancelled')
    }
    return archive
  }, { readOnly: true })
}

export async function saveArchive(file, archive) {
  assertJson(archive)
  const serialized = JSON.stringify(archive, null, 2) + '\n'
  // Never replace an existing backup. Only its owner may read the file.
  const handle = await open(file, 'wx', 0o600)
  try { await handle.writeFile(serialized); await handle.sync() }
  finally { await handle.close() }
}
