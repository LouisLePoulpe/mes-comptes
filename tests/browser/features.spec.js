import {
  test,
  expect,
} from '@playwright/test'

import {
  login,
  setup,
  navigate,
} from './helpers'


async function createAccount(
  page,
  name = 'Compte principal'
) {
  await navigate(
    page,
    'Comptes'
  )

  await page
    .getByLabel(
      'Nom du compte'
    )
    .fill(name)

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
          new RegExp(
            `^${name}$`
          ),
      })
  ).toBeVisible()
}


async function addTransaction(
  page,
  {
    type,
    amount,
    category,
    description,
    date,
  }
) {
  await navigate(
    page,
    'Ajouter'
  )

  await page
    .getByRole(
      'button',
      {
        name: type,
        exact: true,
      }
    )
    .click()

  await page
    .getByLabel(
      'Montant (€)'
    )
    .fill(amount)

  await page
    .getByLabel(
      'Catégorie',
      {
        exact: true,
      }
    )
    .selectOption({
      label: category,
    })

  await page
    .getByLabel(
      'Description',
      {
        exact: true,
      }
    )
    .fill(description)

  await page
    .getByLabel(
      'Date',
      {
        exact: true,
      }
    )
    .fill(date)

  await page
    .getByRole(
      'button',
      {
        name: /Enregistrer/,
      }
    )
    .click()

  await expect(
    page.getByRole(
      'heading',
      {
        name: 'Historique',
        exact: true,
      }
    )
  ).toBeVisible()
}


test(
  'recherche, calculs de montant, modification, thème et responsive',
  async ({
    page,
  }, info) => {
    await page.goto('./')

    await login(
      page,
      `features-${info.project.name}@example.test`
    )

    await setup(page)

    await createAccount(
      page
    )


    /*
     * Trois transactions pour vérifier
     * recherche et doublons légitimes.
     */
    await addTransaction(
      page,
      {
        type: 'Entrée',
        amount: '100',
        category: 'Salaire 💶',
        description: 'Premier salaire',
        date: '2001-01-15',
      }
    )

    await addTransaction(
      page,
      {
        type: 'Sortie',
        amount: '12,50',
        category: 'Charges 💸',
        description: 'Café du marché',
        date: '2025-06-15',
      }
    )

    await addTransaction(
      page,
      {
        type: 'Sortie',
        amount: '12,50',
        category: 'Charges 💸',
        description: 'Café du marché',
        date: '2025-06-15',
      }
    )


    /*
     * Recherche insensible à la casse
     * et aux accents.
     */
    await expect(
      page.getByText(
        '3 transactions',
        {
          exact: true,
        }
      )
    ).toBeVisible()

    await page
      .getByLabel(
        'Rechercher par nom'
      )
      .fill(
        'CAFE marche'
      )

    await expect(
      page.getByText(
        '2 transactions',
        {
          exact: true,
        }
      )
    ).toBeVisible()

    await expect(
      page.getByText(
        'Premier salaire',
        {
          exact: true,
        }
      )
    ).toBeHidden()


    /*
     * Modification avec expression
     * mathématique et virgule française.
     */
    await page
      .getByLabel(
        'Rechercher par nom'
      )
      .fill(
        'salaire'
      )

    await page
      .getByRole(
        'button',
        {
          name:
            'Modifier Premier salaire',
        }
      )
      .click()

    await page
      .getByLabel(
        'Montant (€)'
      )
      .fill(
        '(100 + 7,50) / 2'
      )

    await expect(
      page.getByText(
        'Résultat : 53,75 €'
      )
    ).toBeVisible()

    await page
      .getByRole(
        'button',
        {
          name: 'Sauvegarder',
        }
      )
      .click()

    await expect(
      page.getByText(
        '+53.75€',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Division par zéro refusée.
     */
    await navigate(
      page,
      'Ajouter'
    )

    await page
      .getByLabel(
        'Montant (€)'
      )
      .fill(
        '1 / 0'
      )

    await page
      .getByRole(
        'button',
        {
          name: /Enregistrer/,
        }
      )
      .click()

    await expect(
      page.getByRole('alert')
    ).toHaveText(
      'La division par zéro est impossible.'
    )


    /*
     * Expression valide lors d'une
     * nouvelle transaction.
     */
    await page
      .getByLabel(
        'Montant (€)'
      )
      .fill(
        '12,50 + 2 * 3'
      )

    await page
      .getByLabel(
        'Catégorie',
        {
          exact: true,
        }
      )
      .selectOption({
        label:
          'Charges 💸',
      })

    await page
      .getByLabel(
        'Description',
        {
          exact: true,
        }
      )
      .fill(
        'Achat calculé'
      )

    await page
      .getByRole(
        'button',
        {
          name: /Enregistrer/,
        }
      )
      .click()

    await expect(
      page.getByText(
        '-18.5€',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Le thème est persistant.
     */
    await navigate(
      page,
      'Paramètres'
    )

    await expect(
      page.getByText(
        `features-${info.project.name}@example.test`,
        {
          exact: true,
        }
      )
    ).toBeVisible()

    await page
      .getByRole(
        'button',
        {
          name:
            'Activer le mode clair',
        }
      )
      .click()

    await expect(
      page.locator('html')
    ).toHaveAttribute(
      'data-theme',
      'light'
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
      page.locator('html')
    ).toHaveAttribute(
      'data-theme',
      'light'
    )


    /*
     * Pas de débordement horizontal,
     * notamment sur le projet mobile.
     */
    expect(
      await page.evaluate(
        () =>
          document
            .documentElement
            .scrollWidth <=
          window.innerWidth
      )
    ).toBe(true)


    await navigate(
      page,
      'Paramètres'
    )

    await page
      .getByRole(
        'button',
        {
          name:
            'Activer le mode sombre',
        }
      )
      .click()

    await expect(
      page.locator('html')
    ).toHaveAttribute(
      'data-theme',
      'dark'
    )
  }
)


test(
  'partage : fichier Excel, annulation et solution de téléchargement',
  async ({
    page,
  }, info) => {
    await page.addInitScript(
      () => {
        window.testShareMode =
          'success'

        Object.defineProperty(
          navigator,
          'canShare',
          {
            configurable: true,

            value:
              () => true,
          }
        )

        Object.defineProperty(
          navigator,
          'share',
          {
            configurable: true,

            value:
              async data => {
                window.testSharedFile = {
                  name:
                    data.files[0].name,

                  type:
                    data.files[0].type,

                  size:
                    data.files[0].size,
                }

                if (
                  window.testShareMode ===
                  'cancel'
                ) {
                  throw new DOMException(
                    'cancel',
                    'AbortError'
                  )
                }

                if (
                  window.testShareMode ===
                  'error'
                ) {
                  throw new Error(
                    'unavailable'
                  )
                }
              },
          }
        )
      }
    )

    await page.goto('./')

    await login(
      page,
      `sharing-${info.project.name}@example.test`
    )

    await setup(page)

    await navigate(
      page,
      'Paramètres'
    )


    await page
      .getByRole(
        'button',
        {
          name:
            'Partager l’export',
        }
      )
      .click()

    await expect(
      page.getByRole('status')
    ).toHaveText(
      'Partage terminé.'
    )

    const shared =
      await page.evaluate(
        () =>
          window.testSharedFile
      )

    expect(
      shared.name
    ).toBe(
      'mes-comptes.xlsx'
    )

    expect(
      shared.size
    ).toBeGreaterThan(0)


    await page.evaluate(
      () => {
        window.testShareMode =
          'cancel'
      }
    )

    await page
      .getByRole(
        'button',
        {
          name:
            'Partager l’export',
        }
      )
      .click()

    await expect(
      page.getByRole('status')
    ).toContainText(
      'Partage annulé'
    )


    await page.evaluate(
      () => {
        window.testShareMode =
          'error'
      }
    )

    await page
      .getByRole(
        'button',
        {
          name:
            'Partager l’export',
        }
      )
      .click()

    await expect(
      page.getByRole('status')
    ).toContainText(
      'Partage impossible'
    )


    const downloading =
      page.waitForEvent(
        'download'
      )

    await page
      .getByRole(
        'button',
        {
          name:
            'Export Excel',
          exact: true,
        }
      )
      .click()

    expect(
      (
        await downloading
      ).suggestedFilename()
    ).toBe(
      'mes-comptes.xlsx'
    )
  }
)
