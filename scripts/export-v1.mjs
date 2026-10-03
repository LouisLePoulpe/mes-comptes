import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { readV1Archive, saveArchive } from './export-v1-core.mjs'

const [mode, file] = process.argv.slice(2)
if (!['--production-read-only', '--emulator'].includes(mode) || !file || process.argv.length !== 4) {
  throw new Error('Usage: node scripts/export-v1.mjs --production-read-only|--emulator .migration/backup.json')
}
const target = resolve(file)
if (dirname(target) !== resolve('.migration')) throw new Error('Backup must be directly inside .migration/ (excluded from git)')
const production = mode === '--production-read-only'
const host = process.env.FIRESTORE_EMULATOR_HOST
if (production && host) throw new Error('Remove FIRESTORE_EMULATOR_HOST before a production read')
if (!production && !/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) throw new Error('A local Firestore emulator is required')
const require = createRequire(new URL('../import-comptes/package.json', import.meta.url))
const admin = require('firebase-admin')
const app = admin.initializeApp({ projectId: production ? 'comptes-44440' : 'demo-mes-comptes-v2' })
try {
  const archive = await readV1Archive(app.firestore())
  await mkdir(dirname(target), { recursive: true, mode: 0o700 })
  await saveArchive(target, archive)
  console.log(JSON.stringify({ saved: true, counts: Object.fromEntries(Object.entries(archive).map(([name, rows]) => [name, rows.length])) }))
} finally { await app.delete() }
