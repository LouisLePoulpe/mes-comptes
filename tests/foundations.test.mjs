import { test } from 'node:test'
import assert from 'node:assert/strict'
import { userPath } from '../src/data/paths.js'
import { deriveKey, encrypt, decrypt, saveKeyLocally, loadKeyLocally, clearKeyLocally } from '../src/crypto.js'
import { planMigration, copyMigration } from '../scripts/migration-plan.mjs'

test('paths require explicit uid and prevent collection/path injection', () => {
  assert.deepEqual(userPath('alice', 'transactions', 'one'), ['users', 'alice', 'transactions', 'one'])
  for (const uid of ['', null, 'alice/bob']) assert.throws(() => userPath(uid, 'transactions'))
  assert.throws(() => userPath('alice', 'private'))
  assert.throws(() => userPath('alice', 'config', '../crypto'))
})

test('keys remain isolated across users; clearing one preserves V1 and other users', async () => {
  const values = new Map([['mes-comptes-key', 'legacy']])
  globalThis.localStorage = { setItem: (k, v) => values.set(k, v), getItem: k => values.get(k), removeItem: k => values.delete(k) }
  const { key, saltHex } = await deriveKey('test passphrase')
  await saveKeyLocally(key, saltHex, 'alice')
  assert.equal(await loadKeyLocally('bob'), null)
  await saveKeyLocally(key, saltHex, 'bob')
  clearKeyLocally('alice')
  assert.equal(await loadKeyLocally('alice'), null)
  assert.ok(await loadKeyLocally('bob'))
  assert.equal(values.get('mes-comptes-key'), 'legacy')
})

test('migration preserves exact ciphertext, IDs, full history and unknown banks; never overwrites', async () => {
  const passphrase = 'old passphrase'
  const { key, saltHex } = await deriveKey(passphrase)
  const source = {
    config: [{ id: 'crypto', data: { saltHex } }, { id: 'verif', data: { encrypted: await encrypt({ verif: 'ok' }, key) } }],
    transactions: await Promise.all(['BB', 'CMB', 'TR', 'Savings'].map(async (banque, i) => ({ id: `t${i}`, data: await encrypt({ banque, montant: 10 + i, type: 'Entrée', date: `${2000+i}-01-01` }, key) }))),
    categories: [{ id: 'cat', data: await encrypt({ nom: 'Salaire' }, key) }],
  }
  const original = structuredClone(source)
  const plan = await planMigration(source, 'owner', passphrase)
  assert.deepEqual(source, original)
  assert.equal(plan.counts.transactions, 4)
  assert.equal(plan.counts.accounts, 4)
  for (const row of source.transactions) assert.deepEqual(plan.records.find(r => r.path === `users/owner/transactions/${row.id}`).data, row.data)
  assert.equal((await decrypt(plan.records.find(r => r.path.endsWith('/accounts/BB')).data, key)).name, 'BoursoBank')
  const destination = new Map()
  const adapter = { isEmpty: async () => destination.size === 0, create: async (p, d) => { assert.ok(!destination.has(p)); destination.set(p, d) }, read: async p => destination.get(p) }
  await copyMigration(plan, adapter)
  await assert.rejects(copyMigration(plan, adapter), /not empty/)
  await assert.rejects(planMigration(source, 'owner', 'wrong password'))
  const corrupt = structuredClone(source); corrupt.transactions[0].data.data = 'bad'
  await assert.rejects(planMigration(corrupt, 'owner', passphrase))
  const duplicate = structuredClone(source); duplicate.transactions.push(duplicate.transactions[0])
  await assert.rejects(planMigration(duplicate, 'owner', passphrase), /Duplicate/)
  await assert.rejects(copyMigration(plan, { ...adapter, isEmpty: async () => true, create: async () => {}, read: async () => ({}) }), /Verification failed/)
})

test('wrapped recovery key decrypts the original data without resetting encryption', async () => {
  const { key, saltHex } = await deriveKey('main password')
  const recovery = await deriveKey('recovery words', saltHex)
  const wrapped = await encrypt(Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', key))), recovery.key)
  const recovered = await crypto.subtle.importKey('raw', new Uint8Array(await decrypt(wrapped, recovery.key)), 'AES-GCM', true, ['encrypt', 'decrypt'])
  assert.deepEqual(await decrypt(await encrypt({ historical: 123 }, key), recovered), { historical: 123 })
})
