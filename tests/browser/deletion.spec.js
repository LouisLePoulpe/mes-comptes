import { test, expect } from '@playwright/test'
import { login, setup, navigate } from './helpers'

test('wrong password preserves data; confirmed deletion removes auth and every V2 collection', async ({ page, request }, info) => {
  await page.goto('./')
  const email = 'delete-' + info.project.name + '@example.test'
  await login(page, email)
  await setup(page)
  const uid = await page.evaluate(async () => {
    const { auth } = await import('/mes-comptes/src/firebase.js')
    const { updatePassword, reload } = await import('/mes-comptes/node_modules/.vite/deps/firebase_auth.js')
    await updatePassword(auth.currentUser, 'password-fictif')
    await reload(auth.currentUser)
    return auth.currentUser.uid
  })
  await request.patch('http://127.0.0.1:8080/v1/projects/demo-mes-comptes-v2/databases/(default)/documents/users/' + uid + '/config/extra-test', { headers: { Authorization: 'Bearer owner' }, data: { fields: { test: { booleanValue: true } } } })
  await navigate(page, 'Paramètres')
  await page.getByRole('button', { name: 'Supprimer définitivement', exact: true }).click()
  await page.getByLabel('Mot de passe actuel').fill('incorrect-password')
  await page.getByLabel('Je comprends').check()
  await page.getByRole('button', { name: 'Confirmer la suppression' }).click()
  await expect(page.getByRole('alert')).toContainText('interrompue')
  const list = async name => (await (await request.get('http://127.0.0.1:8080/v1/projects/demo-mes-comptes-v2/databases/(default)/documents/users/' + uid + '/' + name, { headers: { Authorization: 'Bearer owner' } })).json()).documents || []
  expect((await list('categories')).length).toBe(3)
  expect((await list('config')).length).toBeGreaterThan(0)
  await page.getByLabel('Mot de passe actuel').fill('password-fictif')
  await page.getByRole('button', { name: 'Réessayer la suppression' }).click()
  await expect(page.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible()
  for (const name of ['transactions', 'categories', 'accounts', 'config']) expect(await list(name)).toEqual([])
  const loginResult = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key', { data: { email, password: 'password-fictif', returnSecureToken: true } })
  expect(loginResult.ok()).toBe(false)
  expect((await loginResult.json()).error.message).toMatch(/EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS/)
  expect(await page.evaluate(uid => localStorage.getItem('mes-comptes-key:' + uid), uid)).toBeNull()
})
