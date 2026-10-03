import { test, expect } from '@playwright/test'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, getDocs, collection, runTransaction } from 'firebase/firestore'
import { deriveKey, encrypt } from '../../src/crypto.js'
import { planMigration, copyMigration } from '../../scripts/migration-plan.mjs'
import { login, navigate } from './helpers'

test('un historique V1 copié se déverrouille avec sa passphrase et conserve ses sources', async ({ page }, info) => {
  await page.goto('./')
  await login(page, `legacy-${info.project.name}@example.test`)
  await expect(page.getByRole('heading', { name: 'Chiffrement' })).toBeVisible()
  // Fixture setup only: derive the uid from the actual emulator login, never guess ownership.
  const uid = await page.evaluate(async () => (await import('/mes-comptes/src/firebase.js')).auth.currentUser.uid)
  const { key, saltHex } = await deriveKey('passphrase ancienne')
  const source = {
    config: [{ id: 'crypto', data: { saltHex, recoveryVerif: 'legacy-does-not-wrap-a-key' } }, { id: 'verif', data: { encrypted: await encrypt({ verif: 'ok' }, key) } }],
    transactions: [
      { id: `${info.project.name}-old`, data: await encrypt({ banque: 'BB', type: 'Entrée', montant: 123.45, categorie: 'Salaire', description: 'Archive ancienne', date: '2001-01-15T00:00:00.000Z' }, key) },
      { id: `${info.project.name}-recent`, data: await encrypt({ banque: 'TR', type: 'Entrée', montant: 67.89, categorie: 'Salaire', description: 'Archive récente', date: '2025-06-15T00:00:00.000Z' }, key) },
    ],
    categories: [{ id: 'salary', data: await encrypt({ nom: 'Salaire' }, key) }],
  }
  const env = await initializeTestEnvironment({ projectId: 'demo-mes-comptes-v2', firestore: { host: '127.0.0.1', port: 8080 } })
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      for (const row of source.transactions) await setDoc(doc(db, `transactions/${row.id}`), row.data)
      await copyMigration(await planMigration(source, uid, 'passphrase ancienne'), {
        async isEmpty(owner) {
          for (const name of ['config', 'accounts', 'categories', 'transactions']) if (!(await getDocs(collection(db, `users/${owner}/${name}`))).empty) return false
          return true
        },
        async create(path, data) {
          await runTransaction(db, async transaction => {
            const ref = doc(db, path)
            if ((await transaction.get(ref)).exists()) throw new Error('Existing record')
            transaction.set(ref, data)
          })
        },
        async read(path) { return (await getDoc(doc(db, path))).data() },
      })
    })
    await page.reload()
    await expect(page.getByText('Entre ta passphrase pour accéder à tes données')).toBeVisible()
    await page.getByRole('button', { name: 'Clé de récupération', exact: true }).click()
    await page.getByLabel('Clé de récupération (24 mots)').fill('ancienne-cle')
    await page.getByRole('button', { name: "Récupérer l'accès" }).click()
    await expect(page.getByRole('alert')).toContainText('Utilise ta passphrase d’origine')
    await page.getByRole('button', { name: 'Passphrase', exact: true }).click()
    await page.getByLabel('Passphrase', { exact: true }).fill('passphrase ancienne')
    await page.getByRole('button', { name: 'Déverrouiller' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await page.getByRole('combobox').selectOption('all')
    await expect(page.getByText('123.45 €', { exact: true })).toBeVisible()
    await expect(page.getByText('67.89 €', { exact: true })).toBeVisible()
    await navigate(page, 'Historique')
    await expect(page.getByText('2 transactions', { exact: true })).toBeVisible()
    await expect(page.getByText('BoursoBank · Salaire · 15/01/2001', { exact: true })).toBeVisible()
    await expect(page.getByText('Trade Republic · Salaire · 15/06/2025', { exact: true })).toBeVisible()
    // A damaged record must not silently disappear; repairing it clears the error.
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), `users/${uid}/transactions/${source.transactions[0].id}`), { iv: 'bad', data: 'bad' })
    })
    await expect(page.getByRole('alert')).toContainText('Aucun historique partiel')
    await expect(page.getByText('Archive récente', { exact: true })).toBeHidden()
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), `users/${uid}/transactions/${source.transactions[0].id}`), source.transactions[0].data)
    })
    await expect(page.getByText('2 transactions', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await login(page, `legacy-${info.project.name}@example.test`, true)
    // Users can also leave a locked vault without entering its passphrase.
    await expect(page.getByText('Entre ta passphrase pour accéder à tes données')).toBeVisible()
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible()
    await env.withSecurityRulesDisabled(async context => {
      for (const row of source.transactions) expect((await getDoc(doc(context.firestore(), `transactions/${row.id}`))).data()).toEqual(row.data)
    })
  } finally { await env.cleanup() }
})
