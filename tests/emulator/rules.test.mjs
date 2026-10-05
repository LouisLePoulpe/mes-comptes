import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'

test('every V2 collection is owner-only, including keys, list queries and writes', async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-mes-comptes-v2', firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.v2.rules', 'utf8') } })
  try {
    const alice = env.authenticatedContext('alice').firestore()
    const bob = env.authenticatedContext('bob').firestore()
    const anonymous = env.unauthenticatedContext().firestore()
    for (const group of ['transactions', 'categories', 'accounts', 'initialBalances', 'config']) {
      const path = `users/alice/${group}/one`
      await assertSucceeds(setDoc(doc(alice, path), { encrypted: 'fixture' }))
      await assertSucceeds(getDoc(doc(alice, path)))
      await assertSucceeds(getDocs(collection(alice, `users/alice/${group}`)))
      for (const other of [bob, anonymous]) {
        await assertFails(getDoc(doc(other, path)))
        await assertFails(getDocs(collection(other, `users/alice/${group}`)))
        await assertFails(setDoc(doc(other, path), { bad: true }))
        await assertFails(updateDoc(doc(other, path), { bad: true }))
        await assertFails(deleteDoc(doc(other, path)))
      }
      await assertSucceeds(updateDoc(doc(alice, path), { encrypted: 'updated' }))
      await assertSucceeds(deleteDoc(doc(alice, path)))
    }
    for (const path of ['transactions/v1', 'config/crypto', 'users/alice/private/one']) {
      await assertFails(getDoc(doc(alice, path)))
      await assertFails(setDoc(doc(alice, path), { bad: true }))
    }
  } finally { await env.cleanup() }
})


test('password accounts need a verified address for server access', async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-mes-comptes-v2', firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.v2.rules', 'utf8') } })
  try {
    const pending = env.authenticatedContext('email-owner', { email_verified: false, firebase: { sign_in_provider: 'password' } }).firestore()
    const verified = env.authenticatedContext('email-owner', { email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore()
    for (const group of ['transactions', 'categories', 'accounts', 'initialBalances', 'config']) {
      const path = `users/email-owner/${group}/one`
      await assertFails(setDoc(doc(pending, path), { encrypted: 'fixture' }))
      await assertSucceeds(setDoc(doc(verified, path), { encrypted: 'fixture' }))
      await assertFails(getDoc(doc(pending, path)))
      await assertFails(getDocs(collection(pending, `users/email-owner/${group}`)))
      await assertSucceeds(getDoc(doc(verified, path)))
    }
  } finally { await env.cleanup() }
})
