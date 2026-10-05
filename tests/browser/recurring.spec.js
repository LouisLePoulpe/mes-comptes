import {
  test,
  expect,
} from '@playwright/test'

import {
  login,
  setup,
  navigate,
} from './helpers'


function localDayOffset(days) {
  const date = new Date()

  date.setDate(
    date.getDate() + days
  )

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
  'une périodicité génère les occurrences arrivées à échéance et conserve l’historique après suppression',
  async ({ page }, info) => {
    await page.goto('./')

    await login(
      page,
      `recurring-${info.project.name}@example.test`
    )

    await setup(page)


    /*
     * Créer un compte fictif.
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
        'Compte test périodique'
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
            /^Compte test périodique$/,
        })
    ).toBeVisible()


    /*
     * Ouvrir les périodiques.
     */
    await page
      .getByRole(
        'button',
        {
          name: /Paramètres/,
        }
      )
      .first()
      .click()

    await page
      .getByRole(
        'button',
        {
          name: /^Périodiques/,
        }
      )
      .click()

    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'Transactions périodiques',
        }
      )
    ).toBeVisible()


    /*
     * Une sortie quotidienne depuis
     * trois jours doit créer quatre
     * occurrences : J-3, J-2, J-1, J.
     */
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
          'Compte test périodique',
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
        'Test périodique automatique'
      )

    await page
      .getByLabel(
        'Première occurrence'
      )
      .fill(
        localDayOffset(-3)
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
        'Test périodique automatique',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Vérifier la génération réelle.
     */
    await navigate(
      page,
      'Historique'
    )

    await expect(
      page.getByText(
        '4 transactions',
        {
          exact: true,
        }
      )
    ).toBeVisible()

    await expect(
      page.getByText(
        'Test périodique automatique',
        {
          exact: true,
        }
      )
    ).toHaveCount(4)


    /*
     * Modifier une occurrence générée.
     *
     * Elle doit conserver ses métadonnées
     * périodiques après l'enregistrement.
     */
    await page
      .getByRole(
        'button',
        {
          name:
            'Modifier Test périodique automatique',
        }
      )
      .first()
      .click()

    await expect(
      page.getByRole(
        'dialog',
        {
          name:
            'Modifier la transaction',
        }
      )
    ).toBeVisible()

    await page
      .getByLabel(
        'Montant (€)'
      )
      .fill('43')

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
        '-43€',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Si recurringRuleId a bien été
     * conservé, la suppression individuelle
     * doit maintenant être bloquée.
     */
    await page
      .getByRole(
        'button',
        {
          name:
            'Supprimer Test périodique automatique',
        }
      )
      .first()
      .click()

    await expect(
      page.getByRole('alert')
    ).toContainText(
      'Cette transaction provient d’une périodicité.'
    )

    await expect(
      page.getByText(
        '4 transactions',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Recharger : aucune occurrence
     * ne doit être dupliquée.
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
        '4 transactions',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Pause.
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
      .getByRole(
        'button',
        {
          name:
            'Mettre en pause Test périodique automatique',
        }
      )
      .click()

    await expect(
      page.getByText(
        'En pause',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Suppression de la règle.
     * L'historique doit rester.
     */
    page.once(
      'dialog',
      dialog =>
        dialog.accept()
    )

    await page
      .getByRole(
        'button',
        {
          name:
            'Supprimer Test périodique automatique',
        }
      )
      .click()

    await expect(
      page.getByText(
        'Aucune transaction périodique.',
        {
          exact: true,
        }
      )
    ).toBeVisible()

    await navigate(
      page,
      'Historique'
    )

    await expect(
      page.getByText(
        '4 transactions',
        {
          exact: true,
        }
      )
    ).toBeVisible()

    await expect(
      page.getByText(
        'Test périodique automatique',
        {
          exact: true,
        }
      )
    ).toHaveCount(4)
  }
)
