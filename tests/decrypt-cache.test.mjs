import test from 'node:test'
import assert from 'node:assert/strict'
import { createRowDecryptor, reuseRows } from '../src/data/decryptCache.js'

test('each ciphertext is decrypted once, including concurrent snapshots', async () => {
  let calls = 0
  const decryptor = createRowDecryptor(async encrypted => { calls++; await Promise.resolve(); return { amount: encrypted.data } })
  const encrypted = { iv: 'a', data: '10' }
  const [first, second] = await Promise.all([decryptor.row('t1', encrypted), decryptor.row('t1', { ...encrypted })])
  assert.equal(calls, 1)
  assert.strictEqual(first, second)
  assert.deepEqual(first, { amount: '10', id: 't1' })
  assert.strictEqual(await decryptor.row('t1', encrypted), first)
  assert.equal(calls, 1)
})

test('a modified document is decrypted again and deleted documents are forgotten', async () => {
  let calls = 0
  const decryptor = createRowDecryptor(async encrypted => { calls++; return { amount: encrypted.data } })
  const original = await decryptor.row('t1', { iv: 'a', data: '10' })
  const edited = await decryptor.row('t1', { iv: 'b', data: '20' })
  assert.equal(calls, 2)
  assert.notStrictEqual(original, edited)
  assert.equal(edited.amount, '20')
  decryptor.retain(new Set())
  await decryptor.row('t1', { iv: 'b', data: '20' })
  assert.equal(calls, 3)
})

test('a decryption failure is reported to every caller', async () => {
  const decryptor = createRowDecryptor(async () => { throw new Error('bad key') })
  await assert.rejects(decryptor.row('t1', { iv: 'a', data: 'x' }), /bad key/)
  await assert.rejects(decryptor.row('t1', { iv: 'a', data: 'x' }), /bad key/)
})

test('rows are only replaced when something actually changed', () => {
  const a = { id: 'a' }, b = { id: 'b' }
  const previous = [a, b]
  assert.strictEqual(reuseRows(previous, [a, b]), previous)
  const changed = [a, { id: 'b' }]
  assert.strictEqual(reuseRows(previous, changed), changed)
  const shorter = [a]
  assert.strictEqual(reuseRows(previous, shorter), shorter)
  assert.deepEqual(reuseRows(undefined, shorter), shorter)
})
