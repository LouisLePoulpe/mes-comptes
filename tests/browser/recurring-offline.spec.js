import {
  test,
  expect,
} from '@playwright/test'

import {
  login,
  setup,
  navigate,
} from './helpers'


function localDay() {
  const date = new Date()

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getDate()
    ).padStart(2, '0'),
  ].join('-')
}


test(
  'une périodicité créée hors ligne génère sa transaction et se synchronise sans doublon',
  async ({
    page,
    context,
    browser,
  }, info) => {
    const email =
      `recurring-offline-${info.project.name}@example.test`

    await page.goto('./')

    await login(
      page,
      email
    )

    await setup(page)


    /*
     * Compte connu du serveur avant
     * de couper Internet.
     */
    await navigate(
      page,
      'Comptes'
    )

    await page
      .getByLabel(
        'Nom du compte'
      )
      .fill(
        'Compte périodique offline'
      )

    await page
      .getByRole('main')
      .getByRole(
        'button',
        {
          name: 'Ajouter',
          exact: true,
        }
      )
      .click()

    await expect(
      page
        .getByRole('main')
        .locator('span')
        .filter({
          hasText:
            /^Compte périodique offline$/,
        })
    ).toBeVisible()


    await navigate(
      page,
      'Dashboard'
    )

    await expect(
      page.getByRole(
        'button',
        {
          name:
            'Synchronisation : Synchronisé',
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * S'assurer que la PWA et les
     * données sont bien en cache.
     */
    await page.evaluate(
      () =>
        navigator.serviceWorker.ready
    )

    await page.reload()

    await expect(
      page.getByRole(
        'heading',
        {
          name: 'Dashboard',
        }
      )
    ).toBeVisible()


    /*
     * Coupure réseau + redémarrage.
     */
    await context.setOffline(
      true
    )

    await page.reload()

    await expect(
      page.getByRole(
        'heading',
        {
          name: 'Dashboard',
        }
      )
    ).toBeVisible()

    await expect(
      page.getByRole(
        'button',
        {
          name:
            'Synchronisation : Hors ligne',
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Créer la règle entièrement
     * hors ligne.
     */
    await navigate(
      page,
      'Paramètres'
    )

    await page
      .getByRole(
        'button',
        {
          name: /^Périodiques/,
        }
      )
      .click()

    await page
      .getByLabel(
        'Montant (€)'
      )
      .fill('42')

    await page
      .getByLabel(
        'Compte périodique'
      )
      .selectOption({
        label:
          'Compte périodique offline',
      })

    await page
      .getByLabel(
        'Catégorie périodique'
      )
      .selectOption({
        label:
          'Charges 💸',
      })

    await page
      .getByLabel(
        'Description périodique'
      )
      .fill(
        'Périodique créé hors ligne'
      )

    await page
      .getByLabel(
        'Première occurrence'
      )
      .fill(
        localDay()
      )

    await page
      .getByLabel(
        'Intervalle périodique'
      )
      .fill('1')

    await page
      .getByLabel(
        'Unité périodique'
      )
      .selectOption('day')

    await page
      .getByRole(
        'button',
        {
          name:
            'Créer la périodicité',
        }
      )
      .click()

    await expect(
      page.getByText(
        'Périodique créé hors ligne',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * La transaction doit apparaître
     * immédiatement sans réseau.
     */
    await navigate(
      page,
      'Historique'
    )

    await expect(
      page.getByText(
        '1 transaction',
        {
          exact: true,
        }
      )
    ).toBeVisible()

    await expect(
      page.getByText(
        'Périodique créé hors ligne',
        {
          exact: true,
        }
      )
    ).toHaveCount(1)


    /*
     * Fermeture / réouverture hors
     * ligne : persistance et aucun
     * doublon.
     */
    await page.reload()

    await expect(
      page.getByRole(
        'heading',
        {
          name: 'Dashboard',
        }
      )
    ).toBeVisible()

    await navigate(
      page,
      'Historique'
    )

    await expect(
      page.getByText(
        '1 transaction',
        {
          exact: true,
        }
      )
    ).toBeVisible()

    await expect(
      page.getByText(
        'Périodique créé hors ligne',
        {
          exact: true,
        }
      )
    ).toHaveCount(1)


    /*
     * Reconnexion : les écritures
     * locales doivent rejoindre
     * Firestore.
     */
    await context.setOffline(
      false
    )

    await expect(
      page.getByRole(
        'button',
        {
          name:
            'Synchronisation : Synchronisé',
          exact: true,
        }
      )
    ).toBeVisible({
      timeout: 30000,
    })


    /*
     * Second appareil sans cache :
     * vérifier que la transaction
     * existe réellement côté serveur.
     */
    const other =
      await browser.newContext()

    try {
      const remote =
        await other.newPage()

      await remote.goto(
        'http://127.0.0.1:5173/mes-comptes/'
      )

      await login(
        remote,
        email,
        true
      )

      await remote
        .getByLabel(
          'Passphrase',
          {
            exact: true,
          }
        )
        .fill(
          'passphrase fictive'
        )

      await remote
        .getByRole(
          'button',
          {
            name:
              'Déverrouiller',
          }
        )
        .click()

      await navigate(
        remote,
        'Historique'
      )

      await expect(
        remote.getByText(
          '1 transaction',
          {
            exact: true,
          }
        )
      ).toBeVisible()

      await expect(
        remote.getByText(
          'Périodique créé hors ligne',
          {
            exact: true,
          }
        )
      ).toHaveCount(1)
    } finally {
      await other.close()
    }
  }
)
