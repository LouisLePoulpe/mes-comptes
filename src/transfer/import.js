import { runTransaction } from 'firebase/firestore'
import { db } from '../firebase'
import { userDoc } from '../data/references'
import {
  assertImportV21Same,
  V21_IMPORT_GROUPS,
} from './plan'
import { decrypt, encrypt } from '../crypto'

/*
 * ============================================================
 * POULPÉCULE V2.1
 * Écriture sécurisée de l'import exact.
 * ============================================================
 */

const V21_IMPORT_LABELS =
  Object.freeze({
    accounts:
      'Comptes',

    categories:
      'Catégories',

    initialBalances:
      'Montants initiaux',

    transactions:
      'Transactions',

    recurringRules:
      'Transactions périodiques',
  })


function v21ImportVerifyError(
  group,
  id
) {
  const error =
    new Error(
      `${V21_IMPORT_LABELS[group]} : impossible de vérifier l’ID « ${id} ».`
    )

  error.code =
    'IMPORT_VERIFY_FAILED'

  error.collection =
    group

  error.documentId =
    id

  return error
}


/*
 * Vérification réutilisable :
 * le même ID doit obligatoirement
 * contenir exactement les mêmes
 * données.
 */


/*
 * Le plan V2.1 conserve séparément :
 *
 * - les documents à créer selon l'aperçu ;
 * - toutes les lignes du fichier à vérifier.
 *
 * Chaque lot relit donc TOUS les IDs du
 * fichier dans une transaction Firestore
 * juste avant les écritures.
 *
 * Même une ligne déjà identique lors de
 * l'aperçu ne peut donc pas changer
 * silencieusement avant le commit.
 */
export async function commitImportV21(
  uid,
  key,
  plan,
  onProgress = () => {}
) {
  let created = 0
  let skipped = 0
  let raceSkipped = 0
  let processed = 0

  const expected =
    V21_IMPORT_GROUPS.reduce(
      (
        total,
        group
      ) => {
        if (
          !Array.isArray(
            plan[group]
          ) ||
          !Array.isArray(
            plan.verify?.[group]
          )
        ) {
          throw new Error(
            `Plan d’import incomplet pour « ${V21_IMPORT_LABELS[group]} ».`
          )
        }

        return (
          total +
          plan.verify[group].length
        )
      },
      0
    )

  /*
   * Ordre volontaire :
   *
   * comptes
   * catégories
   * montants initiaux
   * transactions
   * périodicités
   *
   * Les règles périodiques sont écrites
   * en dernier afin que leur moteur ne
   * puisse pas générer des occurrences
   * avant la restauration de l'historique.
   */
  for (
    const group
    of V21_IMPORT_GROUPS
  ) {
    const sourceRows =
      plan.verify[group]

    /*
     * IDs qui étaient absents lors
     * de l'aperçu.
     *
     * Si l'un d'eux apparaît entre
     * l'aperçu et le commit avec des
     * données identiques, il sera
     * compté comme raceSkipped.
     */
    const plannedCreateIds =
      new Set(
        plan[group].map(
          row => row.id
        )
      )

    for (
      let start = 0;
      start < sourceRows.length;
      start += 100
    ) {
      const sourceBatch =
        sourceRows.slice(
          start,
          start + 100
        )

      /*
       * Chiffrer avant d'entrer dans la
       * transaction. On évite ainsi du
       * travail asynchrone inutile entre
       * les lectures et les écritures.
       */
      const rows =
        await Promise.all(
          sourceBatch.map(
            async row => ({
              ...row,

              ref:
                userDoc(
                  uid,
                  group,
                  row.id
                ),

              encrypted:
                await encrypt(
                  row.data,
                  key
                ),
            })
          )
        )


      const result =
        await runTransaction(
          db,
          async transaction => {
            /*
             * Firestore exige que toutes
             * les lectures précèdent les
             * écritures dans la transaction.
             */
            const snapshots =
              await Promise.all(
                rows.map(
                  row =>
                    transaction.get(
                      row.ref
                    )
                )
              )

            const toCreate = []
            let skipped = 0
            let raceSkippedInBatch = 0

            for (
              let index = 0;
              index <
              rows.length;
              index++
            ) {
              const row =
                rows[index]

              const snapshot =
                snapshots[index]

              if (
                !snapshot.exists()
              ) {
                toCreate.push(
                  row
                )

                continue
              }


              /*
               * Un document est apparu
               * depuis l'aperçu.
               *
               * On le déchiffre pour
               * comparer les vraies données,
               * jamais le ciphertext AES-GCM
               * qui est volontairement
               * non déterministe.
               */
              let existing

              try {
                existing =
                  await decrypt(
                    snapshot.data(),
                    key
                  )
              } catch {
                throw v21ImportVerifyError(
                  group,
                  row.id
                )
              }


              assertImportV21Same(
                group,
                row.id,
                row.data,
                existing
              )

              skipped++

              if (
                plannedCreateIds.has(
                  row.id
                )
              ) {
                raceSkippedInBatch++
              }
            }


            /*
             * Aucun set() n'est exécuté
             * avant la fin de toutes les
             * vérifications du lot.
             */
            for (
              const row
              of toCreate
            ) {
              transaction.set(
                row.ref,
                row.encrypted
              )
            }


            return {
              created:
                toCreate.length,

              skipped,

              raceSkipped:
                raceSkippedInBatch,
            }
          }
        )


      created +=
        result.created

      skipped +=
        result.skipped

      raceSkipped +=
        result.raceSkipped

      processed +=
        sourceBatch.length

      onProgress(
        processed,
        expected
      )
    }
  }


  return {
    created,

    skipped,

    raceSkipped,

    planned:
      expected,
  }
}
