import { runTransaction } from 'firebase/firestore'
import { db } from '../firebase'
import { userDoc } from '../data/references'
import { encrypt } from '../crypto'

// Deterministic document IDs + read-before-create transactions allow safe retries.
// Existing records (including edited imports) are never overwritten.
export async function commitImport(uid, key, plan, onProgress = () => {}) {
  const groups = ['accounts', 'categories', 'transactions']
  let created = 0, skipped = 0
  for (const group of groups) {
    for (let start = 0; start < plan[group].length; start += 100) {
      const rows = await Promise.all(plan[group].slice(start, start + 100).map(async row => ({ ref: userDoc(uid, group, row.id), data: await encrypt(row.data, key) })))
      // Check session again after asynchronous encryption, before starting a write.
      userDoc(uid, 'config', 'crypto')
      const result = await runTransaction(db, async transaction => {
        const snapshots = await Promise.all(rows.map(row => transaction.get(row.ref)))
        let added = 0
        rows.forEach((row, index) => {
          if (!snapshots[index].exists()) { transaction.set(row.ref, row.data); added++ }
        })
        return added
      })
      if (group === 'transactions') { created += result; skipped += rows.length - result; onProgress(created + skipped) }
    }
  }
  return { created, skipped: skipped + plan.skipped }
}
