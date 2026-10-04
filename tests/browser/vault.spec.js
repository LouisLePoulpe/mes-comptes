import { test, expect } from '@playwright/test'
import * as XLSX from 'xlsx'
import { readFile } from 'node:fs/promises'

import { login, setup, navigate, logout } from './helpers'

async function addTransaction(page, { amount, date, description }) {
  await navigate(page, 'Ajouter')
  await page.getByRole('button', { name: 'Entrée', exact: true }).click()
  await page.getByLabel('Montant (€)').fill(amount)
  await page.getByLabel('Catégorie', { exact: true }).selectOption({ label: 'Salaire' })
  await page.getByLabel('Description', { exact: true }).fill(description)
  await page.getByLabel('Date', { exact: true }).fill(date)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('heading', { name: 'Historique', exact: true })).toBeVisible()
  await expect(page.getByText(description, { exact: true })).toBeVisible()
}

test('coffre, historique complet, comptes, export, récupération et changement d’utilisateur', async ({ page }, info) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const email = `owner-${info.project.name}@example.test`
  await page.goto('./')
  await login(page, email)
  const recovery = await setup(page)

  await navigate(page, 'Comptes')
  await page.getByLabel('Nom du compte').fill('Compte courant')
  await page.getByLabel('Couleur du compte').fill('#10b981')
  await page.getByRole('main').getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(page.getByText('Compte courant', { exact: true })).toBeVisible()
  await navigate(page, 'Catégories')
  await page.getByPlaceholder('Nouvelle catégorie...').fill('Salaire')
  await page.getByRole('button', { name: 'Ajouter la catégorie' }).click()
  await expect(page.getByText('Salaire', { exact: true })).toBeVisible()

  await navigate(page, 'Ajouter')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('alert')).toHaveText('Saisis un montant supérieur à zéro.')

  await addTransaction(page, { amount: '1000.25', date: '2001-01-15', description: 'Premier versement' })
  await addTransaction(page, { amount: '200.50', date: '2025-06-15', description: 'Versement récent' })
  await expect(page.getByText('2 transactions', { exact: true })).toBeVisible()
  await navigate(page, 'Comptes')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.getByLabel('Nom du compte').fill('Compte renommé')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByText('Compte renommé', { exact: true })).toBeVisible()

  await navigate(page, 'Dashboard')
  await page.getByRole('combobox').selectOption('all')
  await expect(page.getByText('1200.75 €', { exact: true })).toBeVisible()
  await expect(page.getByText('Progression des comptes', { exact: true })).toBeVisible()
  await page.getByRole('combobox').selectOption('2025-06')
  await expect(page.getByText('200.50 €', { exact: true })).toBeVisible()
  // Monthly summaries must never truncate the progression chart's full history.
  await expect(page.locator('.recharts-line-curve').first()).toBeVisible()

  await navigate(page, 'Paramètres')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel' }).click()
  const download = await downloaded
  const workbook = XLSX.read(await readFile(await download.path()))
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Transactions)
  expect(rows).toHaveLength(2)
  expect(rows.map(row => row.Banque)).toEqual(['Compte renommé', 'Compte renommé'])
  expect(rows[0].Date).toBe('15/01/2001')
  expect(rows.reduce((sum, row) => sum + row.Montant, 0)).toBe(1200.75)
  await navigate(page, 'Historique')
  await page.getByRole('button', { name: 'Modifier Premier versement' }).click()
  await page.getByLabel('Montant (€)').fill('1001.25')
  await page.getByRole('button', { name: 'Sauvegarder' }).click()
  await expect(page.getByText('+1001.25€', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await logout(page)
  await login(page, email, true)
  await page.getByLabel('Passphrase', { exact: true }).fill('incorrecte')
  await page.getByRole('button', { name: 'Déverrouiller' }).click()
  await expect(page.getByRole('alert')).toHaveText('Passphrase incorrecte')
  await page.getByRole('button', { name: 'Clé de récupération', exact: true }).click()
  await page.getByLabel('Clé de récupération (24 mots)').fill(recovery)
  await page.getByRole('button', { name: "Récupérer l'accès" }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await navigate(page, 'Historique')
  await expect(page.getByText('2 transactions', { exact: true })).toBeVisible()

  await logout(page)
  await login(page, `other-${info.project.name}@example.test`)
  await setup(page)
  await navigate(page, 'Historique')
  await expect(page.getByText('Aucune transaction', { exact: true })).toBeVisible()
  await expect(page.getByText('Premier versement', { exact: true })).toBeHidden()
  await navigate(page, 'Comptes')
  await expect(page.getByText('Ajoute ton premier compte pour saisir des transactions.')).toBeVisible()
  expect(errors).toEqual([])
  // Detect unusable mobile layouts without relying on pixel snapshots.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
