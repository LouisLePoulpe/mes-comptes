import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readV1Archive } from '../../scripts/export-v1-core.mjs'
const require = createRequire(new URL('../../import-comptes/package.json', import.meta.url))
const admin = require('firebase-admin')

test('read-only backup preserves all V1 encrypted documents in the emulator', async () => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required')
  const app = admin.initializeApp({ projectId: 'demo-backup-v1' }, 'backup-test')
  try {
    const db = app.firestore()
    const config = [{ id: 'crypto', data: { saltHex: 'fictitious' } }, { id: 'verif', data: { encrypted: { iv: 'original', data: 'original' } } }]
    for (const row of config) await db.collection('config').doc(row.id).create(row.data)
    const transactions = Array.from({ length: 505 }, (_, i) => ({ id: `row-${String(i).padStart(4, '0')}`, data: { iv: 'fixture', data: `ciphertext-${i}` } }))
    for (let i = 0; i < transactions.length; i += 100) {
      const batch = db.batch()
      for (const row of transactions.slice(i, i + 100)) batch.create(db.collection('transactions').doc(row.id), row.data)
      await batch.commit()
    }
    const archive = await readV1Archive(db)
    assert.deepEqual(archive, { config, transactions, categories: [] })
    assert.deepEqual(await readV1Archive(db), archive)
    assert.equal((await db.collection('transactions').get()).size, 505)
  } finally { await app.delete() }
})
