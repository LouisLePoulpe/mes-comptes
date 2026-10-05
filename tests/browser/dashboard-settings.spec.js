import {
  test,
  expect,
} from '@playwright/test'

import {
  login,
  setup,
  navigate,
} from './helpers'


async function addOperation(
  page,
  {
    type,
    amount,
    category,
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
  'budget V2.1, rôle personnalisé, disposition, tendances, palette et thème système',
  async ({
    page,
  }, info) => {
    await page.emulateMedia({
      colorScheme: 'dark',
    })

    await page.goto('./')

    await login(
      page,
      `budget-${info.project.name}@example.test`
    )

    await setup(page)


    /*
     * Dashboard vide :
     * aucune valeur de budget.
     */
    await expect(
      page.getByTestId(
        'budget-savings'
      )
    ).toContainText('—')

    await page
      .getByRole(
        'button',
        {
          name:
            'Afficher les explications : Répartition du budget',
        }
      )
      .click()

    await expect(
      page.getByRole('dialog')
    ).toContainText('20 %')

    await page
      .getByRole(
        'button',
        {
          name: 'Fermer',
          exact: true,
        }
      )
      .click()


    /*
     * Les catégories V2.1 existent
     * dès la configuration.
     */
    await navigate(
      page,
      'Catégories'
    )

    for (
      const name of [
        'Salaire 💶',
        'Économie 🏦',
        'Charges 💸',
        'Plaisir 🥳',
      ]
    ) {
      await expect(
        page
          .locator('span')
          .filter({
            hasText:
              new RegExp(
                `^${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}$`
              ),
          })
      ).toBeVisible()
    }


    /*
     * Catégorie personnalisée liée
     * au rôle Charges.
     */
    await page
      .getByPlaceholder(
        'Ex : ETF Monde 🌍'
      )
      .fill(
        'Abonnement'
      )

    await page
      .locator('select')
      .selectOption(
        'charges'
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
      page.getByText(
        'Abonnement',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Un seul compte suffit.
     */
    await navigate(
      page,
      'Comptes'
    )

    await expect(
      page.getByRole(
        'button',
        {
          name: 'Bleu',
          exact: true,
        }
      )
    ).toBeVisible()

    await page
      .getByLabel(
        'Nom du compte'
      )
      .fill('Alpha')

    await page
      .getByRole(
        'button',
        {
          name: 'Bleu',
          exact: true,
        }
      )
      .click()

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
      page.getByLabel(
        'Nom du compte'
      )
    ).toHaveValue('')


    /*
     * Total Entrées = 1000 :
     *
     * 800 Salaire
     * + 200 Économie en flux Entrée.
     *
     * L'Économie compte donc à la fois
     * dans Entrées et dans Épargne.
     *
     * Seuils exacts :
     * Épargne = 20 %
     * Charges = 50 %
     * Plaisirs = 30 %
     *
     * Les trois doivent être considérés
     * comme NON respectés.
     */
    await addOperation(
      page,
      {
        type: 'Entrée',
        amount: '800',
        category: 'Salaire 💶',
        date: '2001-01-01',
      }
    )

    await addOperation(
      page,
      {
        type: 'Entrée',
        amount: '200',
        category: 'Économie 🏦',
        date: '2001-01-02',
      }
    )

    await addOperation(
      page,
      {
        type: 'Sortie',
        amount: '500',
        category: 'Abonnement',
        date: '2001-01-03',
      }
    )

    await addOperation(
      page,
      {
        type: 'Sortie',
        amount: '300',
        category: 'Plaisir 🥳',
        date: '2001-01-04',
      }
    )


    /*
     * Vérification des seuils V2.1.
     */
    await navigate(
      page,
      'Dashboard'
    )

    await page
      .getByRole('combobox')
      .selectOption('all')

    for (
      const group of [
        'charges',
        'savings',
        'fun',
      ]
    ) {
      await expect(
        page.getByTestId(
          `budget-${group}`
        )
      ).toHaveClass(
        /text-negative/
      )
    }

    await expect(
      page.getByTestId(
        'budget-charges'
      )
    ).toContainText('50')

    await expect(
      page.getByTestId(
        'budget-savings'
      )
    ).toContainText('20')

    await expect(
      page.getByTestId(
        'budget-fun'
      )
    ).toContainText('30')

    await page.screenshot({
      path:
        info.outputPath(
          'budget-v21.png'
        ),
      fullPage: true,
    })


    /*
     * Préférences du Dashboard.
     */
    await navigate(
      page,
      'Paramètres'
    )

    await page
      .getByRole(
        'button',
        {
          name:
            'Monter Consommation',
        }
      )
      .click()

    await page
      .getByLabel(
        'Afficher les valeurs de tendance'
      )
      .check()

    await page
      .getByRole(
        'button',
        {
          name:
            'Activer le mode système',
        }
      )
      .click()

    await page.emulateMedia({
      colorScheme: 'light',
    })

    await expect(
      page.locator('html')
    ).toHaveAttribute(
      'data-theme',
      'light'
    )


    /*
     * Les tendances doivent être
     * visibles et les préférences
     * doivent survivre au reload.
     */
    await navigate(
      page,
      'Dashboard'
    )

    await expect(
      page.locator(
        '[aria-label="Valeurs de tendance"]'
      )
    ).toContainText('/mois')

    await page.emulateMedia({
      colorScheme: 'dark',
    })

    await expect(
      page.locator('html')
    ).toHaveAttribute(
      'data-theme',
      'dark'
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
      page
        .locator('.grid > div')
        .first()
    ).toContainText(
      'Consommation'
    )

    await navigate(
      page,
      'Paramètres'
    )

    await expect(
      page.getByLabel(
        'Afficher les valeurs de tendance'
      )
    ).toBeChecked()


    /*
     * La catégorie personnalisée
     * reste bien disponible après
     * tous les changements.
     */
    await navigate(
      page,
      'Catégories'
    )

    await expect(
      page.getByText(
        'Abonnement',
        {
          exact: true,
        }
      )
    ).toBeVisible()
  }
)
