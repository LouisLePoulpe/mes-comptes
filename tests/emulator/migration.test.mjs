import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, runTransaction } from 'firebase/firestore'
import { deriveKey, encrypt, decrypt } from '../../src/crypto.js'
import { planMigration, copyMigration } from '../../scripts/migration-plan.mjs'

test('copy and verify more than 500 historical records against real Firestore emulator', async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-mes-comptes-v2', firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.v2.rules', 'utf8') } })
  try {
    const { key, saltHex } = await deriveKey('migration fixture')
    const source = {
      config: [{ id: 'crypto', data: { saltHex } }, { id: 'verif', data: { encrypted: await encrypt({ verif: 'ok' }, key) } }],
      transactions: await Promise.all(Array.from({ length: 501 }, async (_, i) => ({ id: `history-${i}`, data: await encrypt({ banque: i % 2 ? 'BB' : 'TR', type: 'Entrée', montant: 1, date: new Date(Date.UTC(2000, 0, i + 1)).toISOString() }, key) }))),
      categories: [{ id: 'salary', data: await encrypt({ nom: 'Salaire' }, key) }],
    }
    const original = structuredClone(source)
    const plan = await planMigration(source, 'migration-owner', 'migration fixture')
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      const adapter = {
        async isEmpty(uid) {
          for (const group of ['config', 'accounts', 'categories', 'transactions']) if (!(await getDocs(collection(db, `users/${uid}/${group}`))).empty) return false
          return true
        },
        async create(path, data) {
          await runTransaction(db, async transaction => {
            const ref = doc(db, path)
            if ((await transaction.get(ref)).exists()) throw new Error('Already exists')
            transaction.set(ref, data)
          })
        },
        async read(path) { return (await getDoc(doc(db, path))).data() },
      }
      await copyMigration(plan, adapter)
      const copied = await getDocs(collection(db, 'users/migration-owner/transactions'))
      assert.equal(copied.size, 501)
      const values = await Promise.all(copied.docs.map(row => decrypt(row.data(), key)))
      assert.equal(values.reduce((total, row) => total + row.montant, 0), 501)
      assert.equal(values.map(row => row.date).sort()[0], '2000-01-01T00:00:00.000Z')
      await assert.rejects(copyMigration(plan, adapter), /not empty/)
    })
    assert.deepEqual(source, original)
  } finally { await env.cleanup() }
})
