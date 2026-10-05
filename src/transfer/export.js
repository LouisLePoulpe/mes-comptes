import * as XLSX from 'xlsx'

export const EXCEL_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const V21_SHEET_NAMES =
  Object.freeze([
    'Comptes',
    'Montants initiaux',
    'Catégories',
    'Transactions',
    'Transactions périodiques',
  ])


function text(value) {
  return value == null
    ? ''
    : String(value)
}


function appendSheet(
  book,
  name,
  headers,
  rows
) {
  const sheet =
    XLSX.utils.json_to_sheet(
      rows,
      {
        header: headers,
      }
    )

  XLSX.utils.book_append_sheet(
    book,
    sheet,
    name
  )
}


/*
 * Export exact du modèle Poulpécule V2.1.
 *
 * Les relations utilisent les IDs et non
 * les noms affichés afin qu'un import
 * puisse restaurer exactement les liens.
 */
export function createExportV21({
  accounts = [],
  initialBalances = [],
  categories = [],
  transactions = [],
  recurringRules = [],
}) {
  const book =
    XLSX.utils.book_new()


  appendSheet(
    book,
    'Comptes',
    [
      'ID',
      'Nom',
      'Couleur',
    ],
    accounts.map(
      account => ({
        ID:
          account.id,

        Nom:
          account.name,

        Couleur:
          account.color || '',
      })
    )
  )


  appendSheet(
    book,
    'Montants initiaux',
    [
      'ID',
      'CompteID',
      'Nom',
      'Montant',
      'Date',
    ],
    initialBalances.map(
      row => ({
        ID:
          row.id,

        CompteID:
          row.accountId,

        Nom:
          row.label,

        Montant:
          row.amount,

        Date:
          text(row.date),
      })
    )
  )


  appendSheet(
    book,
    'Catégories',
    [
      'ID',
      'Nom',
      'RoleID',
      'ParDéfaut',
    ],
    categories.map(
      category => ({
        ID:
          category.id,

        Nom:
          category.nom,

        RoleID:
          category.roleId,

        ParDéfaut:
          category.defaultRole === true,
      })
    )
  )


  appendSheet(
    book,
    'Transactions',
    [
      'ID',
      'Type',
      'Montant',
      'CompteID',
      'CompteDestID',
      'CatégorieID',
      'Catégorie',
      'Description',
      'Date',
      'RèglePériodiqueID',
      'OccurrencePériodique',
    ],
    transactions.map(
      transaction => ({
        ID:
          transaction.id,

        Type:
          transaction.type,

        Montant:
          transaction.montant,

        CompteID:
          transaction.banque,

        CompteDestID:
          transaction.type ===
          'Transfert'
            ? transaction.banqueDest
            : '',

        CatégorieID:
          transaction.categoryId,

        Catégorie:
          transaction.categorie || '',

        Description:
          transaction.description || '',

        Date:
          text(
            transaction.date
          ),

        RèglePériodiqueID:
          transaction.recurringRuleId ||
          '',

        OccurrencePériodique:
          transaction.recurringOccurrence ||
          '',
      })
    )
  )


  appendSheet(
    book,
    'Transactions périodiques',
    [
      'ID',
      'Type',
      'Montant',
      'CompteID',
      'CompteDestID',
      'CatégorieID',
      'Description',
      'PremièreOccurrence',
      'Fin',
      'Intervalle',
      'Unité',
      'Active',
      'DateEffet',
    ],
    recurringRules.map(
      rule => ({
        ID:
          rule.id,

        Type:
          rule.type,

        Montant:
          rule.montant,

        CompteID:
          rule.banque,

        CompteDestID:
          rule.type ===
          'Transfert'
            ? rule.banqueDest
            : '',

        CatégorieID:
          rule.categoryId,

        Description:
          rule.description || '',

        PremièreOccurrence:
          text(
            rule.startDate
          ),

        Fin:
          text(
            rule.endDate
          ),

        Intervalle:
          Number(
            rule.interval
          ),

        Unité:
          rule.unit,

        Active:
          rule.active !== false,

        DateEffet:
          text(
            rule.effectiveFrom ||
            rule.startDate
          ),
      })
    )
  )


  return new File(
    [
      XLSX.write(
        book,
        {
          bookType: 'xlsx',
          type: 'array',
        }
      ),
    ],
    'mes-comptes.xlsx',
    {
      type: EXCEL_TYPE,
    }
  )
}


/*
 * TEMPORAIRE :
 * ancien export conservé uniquement
 * jusqu'au remplacement complet des
 * tests et de l'import V1.
 */

export function downloadExport(
  file
) {
  const url =
    URL.createObjectURL(file)

  const link =
    document.createElement('a')

  link.href = url
  link.download = file.name

  document.body.appendChild(
    link
  )

  link.click()
  link.remove()

  /*
   * Android Chrome peut ouvrir
   * le fichier légèrement après
   * le clic.
   */
  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    60000
  )
}


export function canShareExport(
  file
) {
  try {
    return (
      !!navigator.share &&
      !!navigator.canShare?.({
        files: [file],
      })
    )
  } catch {
    return false
  }
}


export async function shareExport(
  file
) {
  try {
    await navigator.share({
      files: [file],
      title: 'Poulpécule',
    })

    return 'shared'
  } catch (error) {
    if (
      error.name ===
      'AbortError'
    ) {
      return 'cancelled'
    }

    throw error
  }
}
