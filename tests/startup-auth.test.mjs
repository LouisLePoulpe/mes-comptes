import test from 'node:test'
import assert from 'node:assert/strict'
import { limitStartupAuthRequests } from '../src/data/startupAuth.js'

test('startup deadline aborts only the project lookup/token requests and restores fetch', async () => {
  const previous = globalThis.fetch
  const original = async (input, options) => {
    if (!options?.signal) return 'untouched'
    return new Promise((resolve, reject) => {
      if (options.signal.aborted) reject(new DOMException('Aborted', 'AbortError'))
      else options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
  }
  globalThis.fetch = original
  const restore = limitStartupAuthRequests('project-key', 'http://127.0.0.1:9099', 10)
  try {
    await assert.rejects(fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=project-key'), { name: 'AbortError' })
    await assert.rejects(fetch('https://securetoken.googleapis.com/v1/token?key=project-key'), { name: 'AbortError' })
    for (const url of [
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=project-key',
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=other-project',
      'https://example.com/v1/token?key=project-key',
    ]) assert.equal(await fetch(url), 'untouched')
    restore()
    assert.equal(globalThis.fetch, original)
    assert.equal(await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=project-key'), 'untouched')
  } finally { restore(); globalThis.fetch = previous }
})

test('startup lookup/token fail immediately when the device reports no network', async () => {
  const previous = globalThis.fetch
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  let calls = 0
  globalThis.fetch = async () => { calls++; return 'network' }
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true })
  const restore = limitStartupAuthRequests('project-key', undefined, 5000)
  try {
    const started = Date.now()
    await assert.rejects(fetch('https://securetoken.googleapis.com/v1/token?key=project-key'), TypeError)
    await assert.rejects(fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=project-key'), TypeError)
    assert.ok(Date.now() - started < 500)
    assert.equal(calls, 0)
    // Sign-in is never intercepted, even offline: the SDK reports its own error.
    assert.equal(await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=project-key'), 'network')
    assert.equal(calls, 1)
  } finally {
    restore(); globalThis.fetch = previous
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator
  }
})
