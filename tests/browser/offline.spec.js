import { test, expect } from '@playwright/test'
import process from 'node:process'
import { login, setup, navigate } from './helpers'

test('cached startup does not wait for an unresponsive network or expired token', async ({ page, context }, info) => {
  test.skip(!process.env.OFFLINE_E2E, 'Requires built PWA')
  await page.goto('./')
  await login(page, `slow-network-${info.project.name}@example.test`)
  await setup(page)
  await expect(page.getByRole('button', { name: 'Synchronisation : Synchronisé', exact: true })).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Synchronisation : Synchronisé', exact: true })).toBeVisible()
  // Force token renewal on next boot, as after a long time without using the app.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('firebaseLocalStorageDb')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('firebaseLocalStorage', 'readwrite')
      const store = tx.objectStore('firebaseLocalStorage')
      const cursor = store.openCursor()
      cursor.onsuccess = () => {
        const row = cursor.result
        if (!row) return
        const record = row.value
        if (record.value?.stsTokenManager) { record.value.stsTokenManager.expirationTime = 1; row.update(record) }
        row.continue()
      }
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
  }))
  let releaseNetwork
  const unavailable = new Promise(resolve => { releaseNetwork = resolve })
  await context.route(url => ['8080', '9099'].includes(url.port), async route => {
    await unavailable
    await route.continue().catch(() => {})
  })
  try {
    const start = Date.now()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 3000 })
    expect(Date.now() - start).toBeLessThan(3500)
    expect(await page.evaluate(() => navigator.onLine)).toBe(true)
    await navigate(page, 'Historique')
    await expect(page.getByRole('heading', { name: 'Historique', exact: true })).toBeVisible()
    console.log(`${info.project.name}: cached startup ${Date.now() - start} ms with network requests held`)
  } finally { releaseNetwork() }
  await expect(page.getByRole('button', { name: 'Synchronisation : Synchronisé', exact: true })).toBeVisible({ timeout: 30000 })
  // Background refresh must not send the user back to Dashboard.
  await expect(page.getByRole('heading', { name: 'Historique', exact: true })).toBeVisible()
})

test('offline cold start, edits, persistent queue and server reconciliation', async ({ page, context, browser }, info) => {
  test.skip(!process.env.OFFLINE_E2E, 'Requires built PWA to restart with no network')
  const email = `offline-${info.project.name}@example.test`
  await page.goto('./')
  await login(page, email)
  await setup(page)
  await navigate(page, 'Comptes')
  await page.getByLabel('Nom du compte').fill('Compte hors ligne')
  await page.getByRole('main').getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(
    page
      .getByRole('main')
      .locator('span')
      .filter({
        hasText: /^Compte hors ligne$/,
      })
  ).toBeVisible()
  await navigate(page, 'Dashboard')
  await expect(page.getByRole('button', { name: 'Synchronisation : Synchronisé', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('dashboard.png') })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Synchronisation : Synchronisé', exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Synchronisation : Hors ligne', exact: true })).toBeVisible()

  async function add(description) {
    await navigate(page, 'Ajouter')
    await page.getByLabel('Montant (€)').fill('12,50')
    await page.getByLabel('Catégorie', { exact: true }).selectOption({ label: 'Charges 💸' })
    await page.getByLabel('Description', { exact: true }).fill(description)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('heading', { name: 'Historique', exact: true })).toBeVisible()
    await expect(page.getByText(description, { exact: true })).toBeVisible()
  }
  await add('Courses sans réseau')
  await add('À supprimer hors ligne')
  await page.getByRole('button', { name: 'Modifier Courses sans réseau' }).click()
  await page.getByLabel('Montant (€)').fill('14,75')
  await page.getByRole('button', { name: 'Sauvegarder' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Supprimer À supprimer hors ligne' }).click()
  await expect(page.getByText('À supprimer hors ligne', { exact: true })).toBeHidden()
  await navigate(page, 'Paramètres')
  await page.getByLabel('Afficher les valeurs de tendance').check()
  await expect(page.getByLabel('Afficher les valeurs de tendance')).toBeEnabled()
  await navigate(page, 'Historique')
  await page.getByRole('button', { name: 'Synchronisation : Hors ligne', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Tes modifications sont enregistrées sur cet appareil')
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()

  // Close the app entirely, not merely navigate between its pages.
  await page.close()
  page = await context.newPage()
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await navigate(page, 'Historique')
  await expect(page.getByText('Courses sans réseau', { exact: true })).toBeVisible()
  await expect(page.getByText('-14.75€', { exact: true })).toBeVisible()
  await expect(page.getByText('1 transaction', { exact: true })).toBeVisible()
  await navigate(page, 'Paramètres')
  await expect(page.getByLabel('Afficher les valeurs de tendance')).toBeChecked()
  await page.getByRole('region', { name: 'À propos' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('settings.png') })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('mes-comptes.xlsx')

  // Recovery must also work using cached crypto documents alone.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith('mes-comptes-key:')) localStorage.removeItem(key)
  })
  await page.reload()
  await page.getByLabel('Passphrase', { exact: true }).fill('passphrase fictive')
  await page.getByRole('button', { name: 'Déverrouiller' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByRole('button', { name: 'Synchronisation : Synchronisé', exact: true })).toBeVisible({ timeout: 30000 })

  // An independent device has no local cache: data must really be in Firestore.
  const other = await browser.newContext()
  try {
    const remote = await other.newPage()
    await remote.goto('http://127.0.0.1:5173/mes-comptes/')
    await login(remote, email, true)
    await remote.getByLabel('Passphrase', { exact: true }).fill('passphrase fictive')
    await remote.getByRole('button', { name: 'Déverrouiller' }).click()
    await navigate(remote, 'Historique')
    await expect(remote.getByText('1 transaction', { exact: true })).toBeVisible()
    await expect(remote.getByText('-14.75€', { exact: true })).toBeVisible()
    await navigate(remote, 'Paramètres')
    await expect(remote.getByLabel('Afficher les valeurs de tendance')).toBeChecked()
  } finally { await other.close() }
})
