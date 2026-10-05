import { test } from 'node:test'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore'
import { transitionRules } from '../../scripts/transition-rules.mjs'

test('transition rules preserve both V1 owners and isolate new V2 users in both directions', async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-transition-v2', firestore: { host: '127.0.0.1', port: 8080, rules: transitionRules(['legacy-a', 'legacy-b']) } })
  try {
    const legacyA = env.authenticatedContext('legacy-a').firestore()
    const legacyB = env.authenticatedContext('legacy-b').firestore()
    const fresh = env.authenticatedContext('new-email', { email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore()
    const pending = env.authenticatedContext('new-email', { email_verified: false, firebase: { sign_in_provider: 'password' } }).firestore()
    const anonymous = env.unauthenticatedContext().firestore()
    for (const group of ['transactions', 'categories', 'config']) {
      const path = `${group}/original`
      await assertSucceeds(setDoc(doc(legacyA, path), { encrypted: 'original' }))
      await assertSucceeds(getDoc(doc(legacyB, path)))
      await assertSucceeds(getDocs(collection(legacyB, group)))
      await assertSucceeds(setDoc(doc(legacyB, path), { encrypted: 'still original' }))
      for (const other of [fresh, pending, anonymous]) {
        await assertFails(getDoc(doc(other, path)))
        await assertFails(getDocs(collection(other, group)))
        await assertFails(setDoc(doc(other, path), { bad: true }))
        await assertFails(deleteDoc(doc(other, path)))
      }
    }
    for (const group of ['transactions', 'categories', 'accounts', 'initialBalances', 'recurringRules', 'config']) {
      const path = `users/new-email/${group}/one`
      await assertSucceeds(setDoc(doc(fresh, path), { encrypted: 'new vault' }))
      for (const other of [legacyA, legacyB, pending, anonymous]) {
        await assertFails(getDoc(doc(other, path)))
        await assertFails(getDocs(collection(other, `users/new-email/${group}`)))
        await assertFails(setDoc(doc(other, path), { bad: true }))
      }
    }
    await assertFails(setDoc(doc(legacyA, 'unexpected/root'), { bad: true }))
    await assertFails(setDoc(doc(fresh, 'users/legacy-a/config/crypto'), { bad: true }))
  } finally { await env.cleanup() }
})
