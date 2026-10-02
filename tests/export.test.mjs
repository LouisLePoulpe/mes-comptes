import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readV1Archive, saveArchive } from '../scripts/export-v1-core.mjs'

test('V1 backup reads one consistent read-only snapshot and never replaces a backup', async () => {
  const source = { config: [{ id: 'crypto', data: { saltHex: 'fixture' } }, { id: 'verif', data: { encrypted: { iv: 'original', data: 'ciphertext' } } }], transactions: [{ id: 'oldest', data: { iv: 'exact', data: 'unchanged' } }], categories: [] }
  const db = { collection: name => name, async runTransaction(callback, options) {
    assert.deepEqual(options, { readOnly: true })
    return callback({ get: async name => ({ docs: source[name].map(row => ({ id: row.id, data: () => row.data })) }) })
  } }
  const archive = await readV1Archive(db)
  assert.deepEqual(archive, source)
  const dir = await mkdtemp(join(tmpdir(), 'mes-comptes-backup-'))
  try {
    const file = join(dir, 'backup.json')
    await saveArchive(file, archive)
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), source)
    assert.equal((await stat(file)).mode & 0o777, 0o600)
    await assert.rejects(saveArchive(file, { changed: true }), { code: 'EEXIST' })
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), source)
    await assert.rejects(saveArchive(join(dir, 'invalid.json'), { timestamp: new Date() }), /Unsupported/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
