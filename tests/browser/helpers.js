import { expect } from '@playwright/test'

export async function login(page, email, existing = false) {
  const opened = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click()
  const popup = await opened
  await popup.waitForLoadState("load")
  if (existing) await popup.getByText(email, { exact: true }).click()
  else {
    await popup.getByRole('button', { name: 'Add new account' }).click()
    await popup.locator('#email-input').fill(email)
    await popup.locator('#display-name-input').fill('Utilisateur fictif')
    await popup.getByRole('button', { name: /Sign in with/ }).click()
  }
  await expect(page.getByRole('button', { name: 'Se connecter avec Google' })).toBeHidden()
}

export async function setup(page) {
  await page.getByLabel('Passphrase', { exact: true }).fill('passphrase fictive')
  await page.getByLabel('Confirmer la passphrase').fill('passphrase fictive')
  await page.getByRole('button', { name: 'Continuer' }).click()
  const recovery = await page.getByLabel('Clé à conserver').innerText()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Terminer la configuration' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  return recovery
}

export async function navigate(page, name) {
  if (['Comptes', 'Catégories'].includes(name)) {
    await page.getByRole('navigation').getByRole('button', { name: 'Paramètres', exact: true }).click()
    await page.getByRole('button', { name: new RegExp('^' + name) }).click()
  } else await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}

