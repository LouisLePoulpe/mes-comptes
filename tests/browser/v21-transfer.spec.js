import {
  test,
  expect,
} from '@playwright/test'

import assert from 'node:assert/strict'

import {
  readFile,
} from 'node:fs/promises'

import {
  login,
  setup,
  navigate,
} from './helpers'

import {
  parseExportV21,
} from '../../src/transfer/parse.js'


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


function normalizedExport(
  data
) {
  const result = {}

  for (
    const group
    of [
      'accounts',
      'initialBalances',
      'categories',
      'transactions',
      'recurringRules',
    ]
  ) {
    result[group] =
      [...data[group]]
        .sort(
          (left, right) =>
            left.id.localeCompare(
              right.id
            )
        )
  }

  return result
}


test(
  'un export V2.1 restaure exactement toutes les données dans un autre compte sans doublon',
  async ({
    page,
    browser,
  }, info) => {
    /*
     * ======================================================
     * COMPTE SOURCE
     * ======================================================
     */

    await page.goto('./')

    await login(
      page,
      `v21-source-${info.project.name}@example.test`
    )

    await setup(page)


    /*
     * Créer un compte.
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
        'Compte source V2.1'
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
            /^Compte source V2\.1$/,
        })
    ).toBeVisible()


    /*
     * Ajouter un montant initial.
     */
    await page
      .getByLabel(
        'Nom du montant initial'
      )
      .fill(
        'Solde initial V2.1'
      )

    await page
      .getByLabel(
        'Montant initial',
        {
          exact: true,
        }
      )
      .fill(
        '1234,56'
      )

    await page
      .getByLabel(
        'Date du montant initial',
        {
          exact: true,
        }
      )
      .fill(
        '2026-01-01'
      )

    await page
      .getByRole(
        'button',
        {
          name:
            'Ajouter le montant initial',
        }
      )
      .click()

    await expect(
      page.getByText(
        'Solde initial V2.1',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Ajouter une transaction réelle.
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
        '42,50'
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
        'Transaction export V2.1'
      )

    await page
      .getByRole(
        'button',
        {
          name:
            '✓ Enregistrer',
        }
      )
      .click()

    await expect(
      page.getByText(
        'Transaction export V2.1',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * Ajouter une périodicité future.
     *
     * La première occurrence est
     * volontairement dans le futur :
     * aucune transaction supplémentaire
     * ne doit être générée pendant le test.
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
            /^Périodiques/,
        }
      )
      .click()

    await page
      .getByLabel(
        'Montant (€)'
      )
      .fill('15')

    await page
      .getByLabel(
        'Compte périodique'
      )
      .selectOption({
        label:
          'Compte source V2.1',
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
        'Périodicité export V2.1'
      )

    await page
      .getByLabel(
        'Première occurrence'
      )
      .fill(
        localDayOffset(30)
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
      .selectOption(
        'month'
      )

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
        'Périodicité export V2.1',
        {
          exact: true,
        }
      )
    ).toBeVisible()


    /*
     * ======================================================
     * EXPORT SOURCE
     * ======================================================
     */

    await navigate(
      page,
      'Paramètres'
    )

    const sourceDownloadPromise =
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

    const sourceDownload =
      await sourceDownloadPromise

    expect(
      sourceDownload
        .suggestedFilename()
    ).toBe(
      'mes-comptes.xlsx'
    )

    const sourcePath =
      info.outputPath(
        'v21-source.xlsx'
      )

    await sourceDownload.saveAs(
      sourcePath
    )

    const sourceParsed =
      parseExportV21(
        await readFile(
          sourcePath
        ),
        'v21-source.xlsx'
      )

    assert.equal(
      sourceParsed.accounts.length,
      1
    )

    assert.equal(
      sourceParsed.initialBalances.length,
      1
    )

    assert.equal(
      sourceParsed.transactions.length,
      1
    )

    assert.equal(
      sourceParsed.recurringRules.length,
      1
    )

    assert.equal(
      sourceParsed.categories.length,
      9
    )


    /*
     * ======================================================
     * NOUVEAU COMPTE DESTINATION
     * ======================================================
     */

    const destinationContext =
      await browser.newContext()

    try {
      const destination =
        await destinationContext
          .newPage()

      await destination.goto(
        'http://127.0.0.1:5173/mes-comptes/'
      )

      await login(
        destination,
        `v21-destination-${info.project.name}@example.test`
      )

      await setup(
        destination
      )


      /*
       * Ouvrir le nouvel import V2.1.
       */
      await navigate(
        destination,
        'Paramètres'
      )

      await destination
        .getByRole(
          'button',
          {
            name:
              'Importer un export V2.1',
          }
        )
        .click()

      await expect(
        destination
          .getByRole(
            'heading',
            {
              name:
                'Importer un export V2.1',
            }
          )
      ).toBeVisible()


      /*
       * Importer le fichier du premier
       * compte.
       */
      await destination
        .locator(
          'input[type="file"]'
        )
        .setInputFiles(
          sourcePath
        )

      await expect(
        destination.getByText(
          'Aperçu de l’import',
          {
            exact: true,
          }
        )
      ).toBeVisible()


      /*
       * Les 9 catégories par défaut
       * existent déjà dans le nouveau
       * compte.
       *
       * Il reste donc à créer :
       * - 1 compte
       * - 1 montant initial
       * - 1 transaction
       * - 1 périodicité
       */
      await expect(
        destination.getByText(
          '4 élément(s) à créer',
          {
            exact: true,
          }
        )
      ).toBeVisible()

      await expect(
        destination.getByText(
          '9 élément(s) déjà identique(s)',
          {
            exact: true,
          }
        )
      ).toBeVisible()


      await destination
        .getByRole(
          'button',
          {
            name:
              'Confirmer l’import',
          }
        )
        .click()

      await expect(
        destination.getByRole(
          'heading',
          {
            name:
              'Import terminé',
          }
        )
      ).toBeVisible({
        timeout: 30000,
      })

      await expect(
        destination.getByText(
          '4 élément(s) créé(s).',
          {
            exact: true,
          }
        )
      ).toBeVisible()

      await expect(
        destination.getByText(
          '9 élément(s) déjà présent(s).',
          {
            exact: true,
          }
        )
      ).toBeVisible()


      /*
       * ====================================================
       * VÉRIFICATION DANS L'INTERFACE
       * ====================================================
       */

      await navigate(
        destination,
        'Comptes'
      )

      await expect(
        destination
          .getByRole('main')
          .locator('span')
          .filter({
            hasText:
              /^Compte source V2\.1$/,
          })
      ).toBeVisible()

      await expect(
        destination.getByText(
          'Solde initial V2.1',
          {
            exact: true,
          }
        )
      ).toBeVisible()


      await navigate(
        destination,
        'Historique'
      )

      await expect(
        destination.getByText(
          'Transaction export V2.1',
          {
            exact: true,
          }
        )
      ).toHaveCount(1)


      await navigate(
        destination,
        'Paramètres'
      )

      await destination
        .getByRole(
          'button',
          {
            name:
              /^Périodiques/,
          }
        )
        .click()

      await expect(
        destination.getByText(
          'Périodicité export V2.1',
          {
            exact: true,
          }
        )
      ).toBeVisible()


      /*
       * ====================================================
       * RÉEXPORTER LE COMPTE RESTAURÉ
       * ====================================================
       */

      await navigate(
        destination,
        'Paramètres'
      )

      const restoredDownloadPromise =
        destination.waitForEvent(
          'download'
        )

      await destination
        .getByRole(
          'button',
          {
            name:
              'Export Excel',
            exact: true,
          }
        )
        .click()

      const restoredDownload =
        await restoredDownloadPromise

      const restoredPath =
        info.outputPath(
          'v21-restored.xlsx'
        )

      await restoredDownload.saveAs(
        restoredPath
      )

      const restoredParsed =
        parseExportV21(
          await readFile(
            restoredPath
          ),
          'v21-restored.xlsx'
        )


      /*
       * Le contenu métier du second
       * export doit être strictement
       * identique au premier :
       *
       * mêmes IDs,
       * mêmes liens,
       * mêmes montants,
       * mêmes dates,
       * mêmes périodicités.
       */
      assert.deepEqual(
        normalizedExport(
          restoredParsed
        ),
        normalizedExport(
          sourceParsed
        )
      )


      /*
       * ====================================================
       * SECOND IMPORT : IDEMPOTENCE
       * ====================================================
       */

      await destination
        .getByRole(
          'button',
          {
            name:
              'Importer un export V2.1',
          }
        )
        .click()

      await destination
        .locator(
          'input[type="file"]'
        )
        .setInputFiles(
          sourcePath
        )

      await expect(
        destination.getByText(
          'Toutes les données de ce fichier sont déjà présentes.',
          {
            exact: true,
          }
        )
      ).toBeVisible()

      await expect(
        destination.getByRole(
          'button',
          {
            name:
              'Confirmer l’import',
          }
        )
      ).toHaveCount(0)
    } finally {
      await destinationContext.close()
    }
  }
)
