import {
  useRef,
  useState,
} from 'react'

import {
  useData,
} from '../data/context'

import {
  parseExportV21,
} from '../transfer/parse'

import {
  planImportV21,
} from '../transfer/plan'

import {
  commitImportV21,
} from '../transfer/import'


const GROUPS = [
  {
    id: 'accounts',
    label: 'Comptes',
  },
  {
    id: 'categories',
    label: 'Catégories',
  },
  {
    id: 'initialBalances',
    label: 'Montants initiaux',
  },
  {
    id: 'transactions',
    label: 'Transactions',
  },
  {
    id: 'recurringRules',
    label: 'Transactions périodiques',
  },
]


export default function Importer({
  cryptoKey,
  onClose,
}) {
  const {
    uid,
    accounts,
    categories,
    initialBalances,
    transactions,
    recurringRules,
  } = useData()

  const [source, setSource] =
    useState(null)

  const [plan, setPlan] =
    useState(null)

  const [busy, setBusy] =
    useState(false)

  const [error, setError] =
    useState('')

  const [result, setResult] =
    useState(null)

  const [progress, setProgress] =
    useState(null)

  const guard =
    useRef(false)


  function currentData() {
    return {
      accounts,
      categories,
      initialBalances,
      transactions,
      recurringRules,
    }
  }


  async function choose(
    event
  ) {
    const file =
      event.target
        .files?.[0]

    if (
      !file ||
      guard.current
    ) {
      return
    }

    guard.current = true
    setBusy(true)
    setError('')
    setSource(null)
    setPlan(null)
    setResult(null)
    setProgress(null)

    try {
      if (
        file.size >
        10 * 1024 * 1024
      ) {
        throw new Error(
          'Le fichier dépasse 10 Mo.'
        )
      }

      const parsed =
        parseExportV21(
          await file.arrayBuffer(),
          file.name
        )

      const nextPlan =
        planImportV21(
          parsed,
          currentData()
        )

      setSource({
        ...parsed,
        name:
          file.name,
      })

      setPlan(
        nextPlan
      )
    } catch (cause) {
      setError(
        cause.message ||
        'Fichier illisible.'
      )
    } finally {
      guard.current = false
      setBusy(false)
    }
  }


  async function save() {
    if (
      guard.current ||
      !source
    ) {
      return
    }

    if (
      !navigator.onLine
    ) {
      setError(
        'Reconnecte-toi pour importer. La vérification finale nécessite le serveur.'
      )

      return
    }

    guard.current = true
    setBusy(true)
    setError('')
    setProgress({
      processed: 0,
      total: 0,
    })

    try {
      /*
       * Refaire le plan au moment
       * exact de la confirmation.
       *
       * Si un autre appareil a
       * modifié une donnée depuis
       * l'aperçu, le conflit est
       * détecté ici.
       */
      const freshPlan =
        planImportV21(
          source,
          currentData()
        )

      setPlan(
        freshPlan
      )

      const imported =
        await commitImportV21(
          uid,
          cryptoKey,
          freshPlan,
          (
            processed,
            total
          ) => {
            setProgress({
              processed,
              total,
            })
          }
        )

      setResult(
        imported
      )
    } catch (cause) {
      if (
        cause.code ===
        'IMPORT_CONFLICT'
      ) {
        setError(
          `${cause.message} Recharge l’export ou vérifie les données avant de réessayer.`
        )
      } else {
        setError(
          cause.message ||
          'Import interrompu. Les éléments déjà créés sont conservés et un nouvel essai n’écrasera aucune donnée existante.'
        )
      }
    } finally {
      guard.current = false
      setBusy(false)
    }
  }


  const sourceCount =
    source
      ? GROUPS.reduce(
          (
            total,
            group
          ) =>
            total +
            source[
              group.id
            ].length,
          0
        )
      : 0


  return (
    <section className="max-w-2xl mx-auto space-y-5">

      <div className="flex justify-between items-center gap-3">
        <h2 className="text-2xl font-bold">
          Importer un export V2.1
        </h2>

        <button
          disabled={busy}
          onClick={onClose}
        >
          Retour
        </button>
      </div>


      <div className="bg-card rounded-xl p-4 space-y-2">
        <p>
          Importe un fichier Excel créé
          par Poulpécule V2.1.
        </p>

        <p className="text-sm text-muted">
          Le fichier doit contenir les
          cinq onglets Comptes, Montants
          initiaux, Catégories,
          Transactions et Transactions
          périodiques.
        </p>

        <p className="text-sm text-muted">
          Les identifiants sont conservés
          exactement. Une donnée déjà
          présente et identique sera
          ignorée. Si le même identifiant
          contient des données
          différentes, l’import sera
          bloqué plutôt que de les
          écraser.
        </p>
      </div>


      <label className="block bg-card rounded-xl p-4">
        <span className="font-semibold">
          Fichier à importer
        </span>

        <input
          className="block w-full mt-3"
          type="file"
          accept=".xlsx"
          disabled={busy}
          onChange={choose}
        />
      </label>


      {error && (
        <p
          role="alert"
          className="text-negative bg-card rounded-xl p-4"
        >
          {error}
        </p>
      )}


      {source &&
        plan &&
        !result && (
          <section className="bg-card rounded-xl p-4 space-y-4">
            <div>
              <h3 className="font-semibold">
                Aperçu de l’import
              </h3>

              <p className="text-sm text-muted mt-1">
                {source.name}
                {' · '}
                {sourceCount}
                {' élément(s) dans le fichier'}
              </p>
            </div>


            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">
                      Données
                    </th>

                    <th className="text-right">
                      À créer
                    </th>

                    <th className="text-right">
                      Déjà présentes
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {GROUPS.map(
                    group => (
                      <tr
                        key={
                          group.id
                        }
                      >
                        <th className="text-left font-normal py-2">
                          {
                            group.label
                          }
                        </th>

                        <td className="text-right">
                          {
                            plan[
                              group.id
                            ].length
                          }
                        </td>

                        <td className="text-right">
                          {
                            plan
                              .skipped[
                              group.id
                            ]
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>


            <div className="border-t border-line pt-3 space-y-1">
              <p className="font-semibold">
                {plan.totalToCreate}
                {' élément(s) à créer'}
              </p>

              <p className="text-sm text-muted">
                {plan.totalSkipped}
                {' élément(s) déjà identique(s)'}
              </p>
            </div>


            {plan.totalToCreate >
              0 ? (
              <button
                className="w-full bg-emerald-600 text-white rounded-xl px-4 py-3 font-semibold"
                disabled={busy}
                onClick={save}
              >
                Confirmer l’import
              </button>
            ) : (
              <p
                role="status"
                className="text-positive"
              >
                Toutes les données de ce
                fichier sont déjà
                présentes.
              </p>
            )}
          </section>
        )}


      {busy && (
        <div
          role="status"
          className="bg-card rounded-xl p-4"
        >
          {progress?.total >
          0 ? (
            <>
              Import en cours :{' '}
              {
                progress.processed
              }
              {' / '}
              {
                progress.total
              }
            </>
          ) : (
            'Analyse en cours…'
          )}
        </div>
      )}


      {result && (
        <section
          role="status"
          className="bg-card rounded-xl p-4 space-y-2"
        >
          <h3 className="font-semibold text-positive">
            Import terminé
          </h3>

          <p>
            {result.created}
            {' élément(s) créé(s).'}
          </p>

          <p>
            {result.skipped}
            {' élément(s) déjà présent(s).'}
          </p>

          {result.raceSkipped >
            0 && (
            <p className="text-sm text-muted">
              {
                result.raceSkipped
              }
              {' élément(s) identique(s) ont été détecté(s) pendant l’import et n’ont pas été réécrits.'}
            </p>
          )}
        </section>
      )}
    </section>
  )
}
