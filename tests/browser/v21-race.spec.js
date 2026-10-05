import {
  test,
  expect,
} from '@playwright/test'

import {
  login,
  setup,
  navigate,
} from './helpers'


test(
  'l’import V2.1 détecte les modifications concurrentes et accepte une création concurrente identique',
  async ({
    page,
  }, info) => {
    await page.goto('./')

    await login(
      page,
      `v21-race-${info.project.name}@example.test`
    )

    await setup(page)


    const result =
      await page.evaluate(
        async () => {
          const {
            auth,
          } =
            await import(
              '/mes-comptes/src/firebase.js'
            )

          const {
            encrypt,
            loadKeyLocally,
          } =
            await import(
              '/mes-comptes/src/crypto.js'
            )

          const {
            planImportV21,
          } =
            await import(
              '/mes-comptes/src/transfer/plan.js'
            )

          const {
            commitImportV21,
          } =
            await import(
              '/mes-comptes/src/transfer/import.js'
            )

          const {
            userDoc,
          } =
            await import(
              '/mes-comptes/src/data/references.js'
            )

          const {
            setDoc,
          } =
            await import(
              '/mes-comptes/src/data/offline.js'
            )

          const uid =
            auth.currentUser.uid

          const {
            key,
          } =
            await loadKeyLocally(
              uid
            )


          /*
           * ==================================================
           * 1. Donnée identique à l'aperçu,
           * puis modifiée avant le commit.
           * ==================================================
           */

          const original = {
            id:
              'race_existing_account',

            name:
              'Compte avant modification',

            color:
              '#3e9950',
          }

          await setDoc(
            userDoc(
              uid,
              'accounts',
              original.id
            ),
            await encrypt(
              {
                name:
                  original.name,

                color:
                  original.color,
              },
              key
            )
          )


          const conflictSource = {
            accounts: [
              original,
            ],

            categories: [],
            initialBalances: [],
            transactions: [],
            recurringRules: [],
          }

          const conflictExisting = {
            accounts: [
              original,
            ],

            categories: [],
            initialBalances: [],
            transactions: [],
            recurringRules: [],
          }


          const conflictPlan =
            planImportV21(
              conflictSource,
              conflictExisting
            )


          if (
            conflictPlan.totalToCreate !==
              0 ||
            conflictPlan.totalSkipped !==
              1
          ) {
            throw new Error(
              'Le scénario de conflit n’a pas été préparé correctement.'
            )
          }


          /*
           * Un autre appareil modifie
           * maintenant le document.
           */
          await setDoc(
            userDoc(
              uid,
              'accounts',
              original.id
            ),
            await encrypt(
              {
                name:
                  'Compte modifié ailleurs',

                color:
                  '#3e9950',
              },
              key
            )
          )


          let conflict = null

          try {
            await commitImportV21(
              uid,
              key,
              conflictPlan
            )
          } catch (error) {
            conflict = {
              code:
                error.code,

              collection:
                error.collection,

              documentId:
                error.documentId,
            }
          }


          /*
           * ==================================================
           * 2. Document absent à l'aperçu,
           * puis créé À L'IDENTIQUE avant
           * le commit.
           * ==================================================
           */

          const concurrent = {
            id:
              'race_new_account',

            name:
              'Compte concurrent identique',

            color:
              '#598dc4',
          }


          const createSource = {
            accounts: [
              concurrent,
            ],

            categories: [],
            initialBalances: [],
            transactions: [],
            recurringRules: [],
          }

          const emptyExisting = {
            accounts: [],
            categories: [],
            initialBalances: [],
            transactions: [],
            recurringRules: [],
          }


          const createPlan =
            planImportV21(
              createSource,
              emptyExisting
            )


          if (
            createPlan.totalToCreate !==
              1 ||
            createPlan.totalSkipped !==
              0
          ) {
            throw new Error(
              'Le scénario de création concurrente n’a pas été préparé correctement.'
            )
          }


          /*
           * Un autre appareil crée le
           * même document avec exactement
           * les mêmes données.
           */
          await setDoc(
            userDoc(
              uid,
              'accounts',
              concurrent.id
            ),
            await encrypt(
              {
                name:
                  concurrent.name,

                color:
                  concurrent.color,
              },
              key
            )
          )


          const concurrentResult =
            await commitImportV21(
              uid,
              key,
              createPlan
            )


          return {
            conflict,

            concurrentResult,
          }
        }
      )


    /*
     * La modification concurrente doit
     * être refusée comme conflit.
     */
    expect(
      result.conflict
    ).toEqual({
      code:
        'IMPORT_CONFLICT',

      collection:
        'accounts',

      documentId:
        'race_existing_account',
    })

    /*
     * La création concurrente identique
     * ne crée aucun doublon et est
     * comptée comme collision bénigne.
     */
    expect(
      result.concurrentResult.created
    ).toBe(0)

    expect(
      result.concurrentResult.skipped
    ).toBe(1)

    expect(
      result.concurrentResult.raceSkipped
    ).toBe(1)

    /*
     * Vérification finale via l'application
     * elle-même, donc avec la même instance
     * Firestore que Poulpécule.
     *
     * Le premier document doit toujours
     * porter la valeur écrite par
     * « l'autre appareil » : l'import ne
     * l'a donc pas écrasé.
     */
    await navigate(
      page,
      'Comptes'
    )

    await expect(
      page
        .getByRole('main')
        .locator('span')
        .filter({
          hasText:
            /^Compte modifié ailleurs$/,
        })
    ).toBeVisible()

    await expect(
      page
        .getByRole('main')
        .locator('span')
        .filter({
          hasText:
            /^Compte concurrent identique$/,
        })
    ).toBeVisible()
  }
)
