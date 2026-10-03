import { isDeepStrictEqual } from 'node:util'
import { deriveKey, decrypt, encrypt } from '../src/crypto.js'
import { userPath } from '../src/data/paths.js'

// Input: a trusted offline JSON export: {config:[{id,data}],transactions:[],categories:[]}.
// Never infers ownership: the operator must explicitly supply the owner's Auth uid.
export async function planMigration(source, uid, passphrase) {
  userPath(uid, 'config')
  for (const name of ['config', 'transactions', 'categories']) {
    if (!Array.isArray(source[name])) throw new Error(`Missing collection: ${name}`)
    const ids = new Set()
    for (const row of source[name]) {
      userPath(uid, name, row.id)
      if (ids.has(row.id)) throw new Error(`Duplicate ID: ${name}/${row.id}`)
      ids.add(row.id)
    }
  }
  const config = source.config.find(row => row.id === 'crypto')?.data
  const verif = source.config.find(row => row.id === 'verif')?.data
  if (!config?.saltHex || !verif?.encrypted) throw new Error('Missing encryption configuration')
  const { key } = await deriveKey(passphrase, config.saltHex)
  if ((await decrypt(verif.encrypted, key)).verif !== 'ok') throw new Error('Invalid verification')
  const accounts = new Map()
  const known = { BB: ['BoursoBank', '#facc15'], CMB: ['Crédit Mutuel', '#60a5fa'], TR: ['Trade Republic', '#f97316'] }
  for (const row of source.transactions) {
    const transaction = await decrypt(row.data, key)
    userPath(uid, 'accounts', transaction.banque)
    if (!Number.isFinite(transaction.montant) || !Number.isFinite(Date.parse(transaction.date)) || !['Entrée', 'Sortie'].includes(transaction.type)) throw new Error(`Invalid transaction: ${row.id}`)
    const [name, color] = known[transaction.banque] || [transaction.banque, '#60a5fa']
    accounts.set(transaction.banque, { name, color })
  }
  for (const row of source.categories) await decrypt(row.data, key)
  const records = ['config', 'transactions', 'categories'].flatMap(name => source[name].map(row => ({
    path: userPath(uid, name, row.id).join('/'), data: structuredClone(row.data),
  })))
  for (const [id, account] of accounts) records.push({ path: userPath(uid, 'accounts', id).join('/'), data: await encrypt(account, key) })
  return { uid, records, counts: { transactions: source.transactions.length, categories: source.categories.length, accounts: accounts.size } }
}

// Adapter must provide atomic create-only writes, never set/update/delete.
// Existing destination must be empty; interrupted copies are investigated, never overwritten.
export async function copyMigration(plan, target) {
  if (!(await target.isEmpty(plan.uid))) throw new Error('Destination is not empty')
  for (const record of plan.records) await target.create(record.path, record.data)
  for (const record of plan.records) {
    if (!isDeepStrictEqual(await target.read(record.path), record.data)) throw new Error(`Verification failed: ${record.path}`)
  }
  return plan.counts
}
