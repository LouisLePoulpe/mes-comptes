/*
 * ============================================================
 * POULPÉCULE V2.1
 * Plan d'import exact basé sur les IDs.
 * ============================================================
 */

export const V21_IMPORT_GROUPS =
  Object.freeze([
    'accounts',
    'categories',
    'initialBalances',
    'transactions',
    'recurringRules',
  ])


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


function withoutId(
  row
) {
  const data = {
    ...row,
  }

  delete data.id

  return data
}


function canonicalImportValue(
  value
) {
  if (
    Array.isArray(value)
  ) {
    return value.map(
      canonicalImportValue
    )
  }

  if (
    value &&
    typeof value ===
      'object'
  ) {
    return Object.fromEntries(
      Object.keys(value)
        .filter(
          key =>
            value[key] !==
            undefined
        )
        .sort()
        .map(
          key => [
            key,
            canonicalImportValue(
              value[key]
            ),
          ]
        )
    )
  }

  return value
}


export function sameImportData(
  left,
  right
) {
  return (
    JSON.stringify(
      canonicalImportValue(
        withoutId(left)
      )
    ) ===
    JSON.stringify(
      canonicalImportValue(
        withoutId(right)
      )
    )
  )
}


function importConflict(
  group,
  id
) {
  const error =
    new Error(
      `${V21_IMPORT_LABELS[group]} : l’ID « ${id} » existe déjà avec des données différentes. Aucun écrasement automatique n’est autorisé.`
    )

  error.code =
    'IMPORT_CONFLICT'

  error.collection =
    group

  error.documentId =
    id

  return error
}



export function assertImportV21Same(
  group,
  id,
  incoming,
  existing
) {
  if (
    !sameImportData(
      {
        ...incoming,
        id,
      },
      {
        ...existing,
        id,
      }
    )
  ) {
    throw importConflict(
      group,
      id
    )
  }

  return true
}


export function planImportV21(
  source,
  existing
) {
  const result = {
    accounts: [],
    categories: [],
    initialBalances: [],
    transactions: [],
    recurringRules: [],

    /*
     * Toutes les lignes du fichier.
     *
     * Les tableaux ci-dessus servent
     * uniquement à l'aperçu des créations.
     *
     * verify sert à la vérification
     * transactionnelle finale : même une
     * ligne déjà identique à l'aperçu doit
     * être relue juste avant l'écriture.
     */
    verify: {
      accounts: [],
      categories: [],
      initialBalances: [],
      transactions: [],
      recurringRules: [],
    },

    skipped: {
      accounts: 0,
      categories: 0,
      initialBalances: 0,
      transactions: 0,
      recurringRules: 0,
    },

    totalToCreate: 0,
    totalSkipped: 0,
  }


  for (
    const group
    of V21_IMPORT_GROUPS
  ) {
    const incoming =
      source[group]

    const current =
      existing[group]

    if (
      !Array.isArray(
        incoming
      ) ||
      !Array.isArray(
        current
      )
    ) {
      throw new Error(
        `Données d’import incomplètes pour « ${V21_IMPORT_LABELS[group]} ».`
      )
    }


    const currentById =
      new Map(
        current.map(
          row => [
            row.id,
            row,
          ]
        )
      )


    for (
      const row
      of incoming
    ) {
      /*
       * Toujours conserver la version
       * exacte venant du fichier.
       *
       * Elle sera revérifiée directement
       * dans Firestore au moment du commit.
       */
      result.verify[group].push({
        id: row.id,
        data: withoutId(row),
      })

      const present =
        currentById.get(
          row.id
        )

      /*
       * L'ID n'existe pas :
       * l'enregistrement sera créé
       * avec exactement le même ID.
       */
      if (!present) {
        result[group].push({
          id:
            row.id,

          data:
            withoutId(row),
        })

        result.totalToCreate++
        continue
      }


      /*
       * Même ID et mêmes données :
       * rien à faire.
       */
      if (
        sameImportData(
          row,
          present
        )
      ) {
        result.skipped[group]++
        result.totalSkipped++
        continue
      }


      /*
       * Même ID mais contenu différent :
       * on bloque l'import.
       *
       * Poulpécule ne choisit jamais
       * automatiquement quelle version
       * doit remplacer l'autre.
       */
      throw importConflict(
        group,
        row.id
      )
    }
  }


  return result
}
