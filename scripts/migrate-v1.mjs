import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { planMigration, copyMigration } from './migration-plan.mjs'

const [file, uid, mode = '--dry-run'] = process.argv.slice(2)
if (!file || !uid || !['--dry-run', '--copy-to-emulator'].includes(mode)) throw new Error('Usage: node scripts/migrate-v1.mjs export.json OWNER_UID [--dry-run|--copy-to-emulator]')
if (!process.env.MIGRATION_PASSPHRASE) throw new Error('MIGRATION_PASSPHRASE required (never pass it as a CLI argument)')
const source = JSON.parse(await readFile(file, 'utf8'))
const plan = await planMigration(source, uid, process.env.MIGRATION_PASSPHRASE)
delete process.env.MIGRATION_PASSPHRASE
console.log(JSON.stringify({ mode, counts: plan.counts }))
if (mode === '--copy-to-emulator') {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) throw new Error('Only a local emulator is allowed; production writes are disabled')
  const require = createRequire(new URL('../import-comptes/package.json', import.meta.url))
  const admin = require('firebase-admin')
  admin.initializeApp({ projectId: 'demo-mes-comptes-v2' })
  const db = admin.firestore()
  await copyMigration(plan, {
    async isEmpty(owner) {
      const parent = db.doc(`users/${owner}`)
      return !(await parent.get()).exists && (await parent.listCollections()).length === 0
    },
    async create(path, data) { await db.doc(path).create(data) },
    async read(path) { return (await db.doc(path).get()).data() },
  })
  console.log('Copy verified. V1 source unchanged.')
  await admin.app().delete()
}
