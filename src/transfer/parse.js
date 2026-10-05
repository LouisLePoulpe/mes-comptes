import * as XLSX from 'xlsx'

export function importDate(value, date1904 = false) {
  let year, month, day
  if (typeof value === 'number') {
    const parts = XLSX.SSF.parse_date_code(value, { date1904 })
    if (!parts) throw new Error('Date Excel invalide')
    ;({ y: year, m: month, d: day } = parts)
  } else {
    const text = String(value ?? '').trim()
    const french = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(text)
    if (french) [, day, month, year] = french.map(Number)
    else if (iso) [, year, month, day] = iso.map(Number)
    else throw new Error('Date attendue au format JJ/MM/AAAA')
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (year < 1900 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Date invalide')
  return date.toISOString()
}
/*
 * ============================================================
 * POULPÉCULE V2.1
 * Import strict du nouveau format à cinq onglets.
 * ============================================================
 */

import {
  CATEGORY_ROLES,
  FLOWS,
  assertCategoryFlow,
} from '../domain/categoryRoles.js'

import {
  RECURRENCE_UNITS,
} from '../domain/recurring.js'

import {
  V21_SHEET_NAMES,
} from './export.js'


const V21_HEADERS =
  Object.freeze({
    'Comptes': [
      'ID',
      'Nom',
      'Couleur',
    ],

    'Montants initiaux': [
      'ID',
      'CompteID',
      'Nom',
      'Montant',
      'Date',
    ],

    'Catégories': [
      'ID',
      'Nom',
      'RoleID',
      'ParDéfaut',
    ],

    'Transactions': [
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

    'Transactions périodiques': [
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
  })


const V21_ROLE_IDS =
  new Set(
    CATEGORY_ROLES.map(
      role => role.id
    )
  )


const V21_FLOWS =
  new Set(
    Object.values(FLOWS)
  )


const V21_UNITS =
  new Set(
    Object.values(
      RECURRENCE_UNITS
    )
  )


function v21Text(
  value,
  label,
  maxLength,
  required = true
) {
  const result =
    String(
      value ?? ''
    ).trim()

  if (
    required &&
    !result
  ) {
    throw new Error(
      `${label} manquant`
    )
  }

  if (
    result.length >
    maxLength
  ) {
    throw new Error(
      `${label} trop long`
    )
  }

  return result
}


function v21Id(
  value,
  label
) {
  const id =
    v21Text(
      value,
      label,
      500
    )

  if (
    id.includes('/')
  ) {
    throw new Error(
      `${label} invalide`
    )
  }

  return id
}


function v21Amount(
  value,
  label,
  {
    positive = false,
  } = {}
) {
  const text =
    String(
      value ?? ''
    )
      .trim()
      .replace(
        /[\s\u00a0\u202f]/g,
        ''
      )
      .replace(',', '.')

  if (
    !/^-?\d+(?:\.\d{1,2})?$/.test(
      text
    )
  ) {
    throw new Error(
      `${label} invalide`
    )
  }

  const amount =
    Number(text)

  const cents =
    Math.round(
      amount * 100
    )

  if (
    !Number.isFinite(amount) ||
    !Number.isSafeInteger(cents) ||
    Math.abs(
      amount * 100 -
      cents
    ) > 1e-7
  ) {
    throw new Error(
      `${label} invalide`
    )
  }

  if (
    positive &&
    amount <= 0
  ) {
    throw new Error(
      `${label} doit être supérieur à zéro`
    )
  }

  return cents / 100
}


function v21Boolean(
  value,
  label
) {
  if (
    typeof value ===
    'boolean'
  ) {
    return value
  }

  const normalized =
    String(
      value ?? ''
    )
      .trim()
      .toLowerCase()

  if (
    normalized === 'true' ||
    normalized === 'vrai' ||
    normalized === '1'
  ) {
    return true
  }

  if (
    normalized === 'false' ||
    normalized === 'faux' ||
    normalized === '0'
  ) {
    return false
  }

  throw new Error(
    `${label} doit être vrai ou faux`
  )
}


function v21Day(
  value,
  label,
  optional = false
) {
  const text =
    String(
      value ?? ''
    ).trim()

  if (
    optional &&
    !text
  ) {
    return ''
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/
      .exec(text)

  if (!match) {
    throw new Error(
      `${label} doit être au format AAAA-MM-JJ`
    )
  }

  const [
    ,
    year,
    month,
    day,
  ] = match.map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      `${label} invalide`
    )
  }

  return text
}


function v21Timestamp(
  value,
  label
) {
  const text =
    String(
      value ?? ''
    ).trim()

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
      .test(text) ||
    !Number.isFinite(
      Date.parse(text)
    )
  ) {
    throw new Error(
      `${label} doit être une date ISO UTC`
    )
  }

  return text
}


function v21ReadSheet(
  workbook,
  name
) {
  const sheet =
    workbook.Sheets[name]

  if (
    !sheet?.['!ref']
  ) {
    throw new Error(
      `Onglet « ${name} » vide ou manquant`
    )
  }

  const range =
    XLSX.utils.decode_range(
      sheet['!ref']
    )

  if (
    range.e.r > 50000 ||
    range.e.c > 50
  ) {
    throw new Error(
      `Onglet « ${name} » trop volumineux`
    )
  }

  if (
    Object.entries(sheet)
      .some(
        ([key, cell]) =>
          !key.startsWith('!') &&
          cell &&
          typeof cell ===
            'object' &&
          cell.f
      )
  ) {
    throw new Error(
      `Les formules ne sont pas acceptées dans « ${name} »`
    )
  }

  const table =
    XLSX.utils.sheet_to_json(
      sheet,
      {
        header: 1,
        defval: '',
        raw: true,
        blankrows: false,
      }
    )

  const expected =
    V21_HEADERS[name]

  const actual =
    (table[0] || [])
      .map(
        value =>
          String(
            value ?? ''
          ).trim()
      )

  if (
    actual.length !==
      expected.length ||
    expected.some(
      (header, index) =>
        actual[index] !==
        header
    )
  ) {
    throw new Error(
      `Colonnes invalides dans « ${name} »`
    )
  }

  return table
    .slice(1)
    .filter(
      row =>
        row.some(
          value =>
            String(
              value ?? ''
            ).trim() !== ''
        )
    )
    .map(
      (row, index) => ({
        line:
          index + 2,

        value:
          Object.fromEntries(
            expected.map(
              (
                header,
                column
              ) => [
                header,
                row[column] ?? '',
              ]
            )
          ),
      })
    )
}


function v21UniqueIds(
  rows,
  label
) {
  const seen =
    new Set()

  for (
    const row
    of rows
  ) {
    if (
      seen.has(
        row.id
      )
    ) {
      throw new Error(
        `${label} : ID dupliqué « ${row.id} »`
      )
    }

    seen.add(
      row.id
    )
  }
}


export function parseExportV21(
  buffer,
  filename
) {
  if (
    !/\.xlsx$/i.test(
      filename
    )
  ) {
    throw new Error(
      'Le format V2.1 nécessite un fichier .xlsx.'
    )
  }

  if (
    buffer.byteLength >
    10 * 1024 * 1024
  ) {
    throw new Error(
      'Le fichier dépasse 10 Mo.'
    )
  }

  const workbook =
    XLSX.read(
      buffer,
      {
        type: 'array',
        raw: true,
        cellDates: false,
        cellFormula: true,
      }
    )

  if (
    workbook.SheetNames.length !==
      V21_SHEET_NAMES.length ||
    V21_SHEET_NAMES.some(
      (name, index) =>
        workbook
          .SheetNames[index] !==
        name
    )
  ) {
    throw new Error(
      'Ce fichier n’est pas au format Poulpécule V2.1 : les cinq onglets attendus sont absents ou dans le mauvais ordre.'
    )
  }


  /*
   * Comptes
   */
  const accounts =
    v21ReadSheet(
      workbook,
      'Comptes'
    ).map(
      ({ line, value }) => {
        try {
          const color =
            v21Text(
              value.Couleur,
              'Couleur',
              20
            )

          if (
            !/^#[0-9a-fA-F]{6}$/
              .test(color)
          ) {
            throw new Error(
              'Couleur invalide'
            )
          }

          return {
            id:
              v21Id(
                value.ID,
                'ID du compte'
              ),

            name:
              v21Text(
                value.Nom,
                'Nom du compte',
                100
              ),

            color,
          }
        } catch (error) {
          throw new Error(
            `Comptes ligne ${line} : ${error.message}`
          )
        }
      }
    )

  v21UniqueIds(
    accounts,
    'Comptes'
  )

  const accountIds =
    new Set(
      accounts.map(
        row => row.id
      )
    )


  /*
   * Catégories
   */
  const categories =
    v21ReadSheet(
      workbook,
      'Catégories'
    ).map(
      ({ line, value }) => {
        try {
          const roleId =
            v21Text(
              value.RoleID,
              'RoleID',
              100
            )

          if (
            !V21_ROLE_IDS.has(
              roleId
            )
          ) {
            throw new Error(
              `RoleID inconnu « ${roleId} »`
            )
          }

          return {
            id:
              v21Id(
                value.ID,
                'ID de catégorie'
              ),

            nom:
              v21Text(
                value.Nom,
                'Nom de catégorie',
                200
              ),

            roleId,

            defaultRole:
              v21Boolean(
                value.ParDéfaut,
                'ParDéfaut'
              ),
          }
        } catch (error) {
          throw new Error(
            `Catégories ligne ${line} : ${error.message}`
          )
        }
      }
    )

  v21UniqueIds(
    categories,
    'Catégories'
  )

  const categoryById =
    new Map(
      categories.map(
        row => [
          row.id,
          row,
        ]
      )
    )


  /*
   * Montants initiaux
   */
  const initialBalances =
    v21ReadSheet(
      workbook,
      'Montants initiaux'
    ).map(
      ({ line, value }) => {
        try {
          const accountId =
            v21Id(
              value.CompteID,
              'CompteID'
            )

          if (
            !accountIds.has(
              accountId
            )
          ) {
            throw new Error(
              `CompteID inconnu « ${accountId} »`
            )
          }

          return {
            id:
              v21Id(
                value.ID,
                'ID du montant initial'
              ),

            accountId,

            label:
              v21Text(
                value.Nom,
                'Nom du montant initial',
                100
              ),

            amount:
              v21Amount(
                value.Montant,
                'Montant initial'
              ),

            date:
              v21Timestamp(
                value.Date,
                'Date'
              ),
          }
        } catch (error) {
          throw new Error(
            `Montants initiaux ligne ${line} : ${error.message}`
          )
        }
      }
    )

  v21UniqueIds(
    initialBalances,
    'Montants initiaux'
  )


  /*
   * Transactions
   */
  const transactions =
    v21ReadSheet(
      workbook,
      'Transactions'
    ).map(
      ({ line, value }) => {
        try {
          const type =
            v21Text(
              value.Type,
              'Type',
              20
            )

          if (
            !V21_FLOWS.has(
              type
            )
          ) {
            throw new Error(
              `Type inconnu « ${type} »`
            )
          }

          const banque =
            v21Id(
              value.CompteID,
              'CompteID'
            )

          if (
            !accountIds.has(
              banque
            )
          ) {
            throw new Error(
              `CompteID inconnu « ${banque} »`
            )
          }

          const categoryId =
            v21Id(
              value.CatégorieID,
              'CatégorieID'
            )

          const category =
            categoryById.get(
              categoryId
            )

          if (!category) {
            throw new Error(
              `CatégorieID inconnu « ${categoryId} »`
            )
          }

          assertCategoryFlow(
            category,
            type
          )

          const destination =
            v21Text(
              value.CompteDestID,
              'CompteDestID',
              500,
              false
            )

          if (
            type ===
            FLOWS.TRANSFER
          ) {
            if (
              !destination ||
              !accountIds.has(
                destination
              ) ||
              destination ===
                banque
            ) {
              throw new Error(
                'Un transfert nécessite un CompteDestID existant et différent'
              )
            }
          } else if (
            destination
          ) {
            throw new Error(
              'CompteDestID doit être vide hors transfert'
            )
          }

          const recurringRuleId =
            v21Text(
              value.RèglePériodiqueID,
              'RèglePériodiqueID',
              500,
              false
            )

          const recurringOccurrence =
            v21Text(
              value.OccurrencePériodique,
              'OccurrencePériodique',
              20,
              false
            )

          if (
            Boolean(
              recurringRuleId
            ) !==
            Boolean(
              recurringOccurrence
            )
          ) {
            throw new Error(
              'RèglePériodiqueID et OccurrencePériodique doivent être renseignés ensemble'
            )
          }

          if (
            recurringOccurrence
          ) {
            v21Day(
              recurringOccurrence,
              'OccurrencePériodique'
            )
          }

          return {
            id:
              v21Id(
                value.ID,
                'ID de transaction'
              ),

            type,

            montant:
              v21Amount(
                value.Montant,
                'Montant',
                {
                  positive: true,
                }
              ),

            banque,

            ...(type ===
            FLOWS.TRANSFER
              ? {
                  banqueDest:
                    destination,
                }
              : {}),

            categoryId,

            categorie:
              v21Text(
                value.Catégorie,
                'Catégorie',
                200
              ),

            description:
              v21Text(
                value.Description,
                'Description',
                2000,
                false
              ),

            date:
              v21Timestamp(
                value.Date,
                'Date'
              ),

            ...(recurringRuleId
              ? {
                  recurringRuleId,

                  recurringOccurrence,
                }
              : {}),
          }
        } catch (error) {
          throw new Error(
            `Transactions ligne ${line} : ${error.message}`
          )
        }
      }
    )

  v21UniqueIds(
    transactions,
    'Transactions'
  )


  /*
   * Transactions périodiques
   */
  const recurringRules =
    v21ReadSheet(
      workbook,
      'Transactions périodiques'
    ).map(
      ({ line, value }) => {
        try {
          const type =
            v21Text(
              value.Type,
              'Type',
              20
            )

          if (
            !V21_FLOWS.has(
              type
            )
          ) {
            throw new Error(
              `Type inconnu « ${type} »`
            )
          }

          const banque =
            v21Id(
              value.CompteID,
              'CompteID'
            )

          if (
            !accountIds.has(
              banque
            )
          ) {
            throw new Error(
              `CompteID inconnu « ${banque} »`
            )
          }

          const categoryId =
            v21Id(
              value.CatégorieID,
              'CatégorieID'
            )

          const category =
            categoryById.get(
              categoryId
            )

          if (!category) {
            throw new Error(
              `CatégorieID inconnu « ${categoryId} »`
            )
          }

          assertCategoryFlow(
            category,
            type
          )

          const banqueDest =
            v21Text(
              value.CompteDestID,
              'CompteDestID',
              500,
              false
            )

          if (
            type ===
            FLOWS.TRANSFER
          ) {
            if (
              !banqueDest ||
              !accountIds.has(
                banqueDest
              ) ||
              banqueDest ===
                banque
            ) {
              throw new Error(
                'Un transfert périodique nécessite un CompteDestID existant et différent'
              )
            }
          } else if (
            banqueDest
          ) {
            throw new Error(
              'CompteDestID doit être vide hors transfert'
            )
          }

          const startDate =
            v21Day(
              value.PremièreOccurrence,
              'PremièreOccurrence'
            )

          const endDate =
            v21Day(
              value.Fin,
              'Fin',
              true
            )

          if (
            endDate &&
            endDate < startDate
          ) {
            throw new Error(
              'Fin antérieure à PremièreOccurrence'
            )
          }

          const interval =
            Number(
              value.Intervalle
            )

          if (
            !Number.isInteger(
              interval
            ) ||
            interval < 1 ||
            interval > 10000
          ) {
            throw new Error(
              'Intervalle invalide'
            )
          }

          const unit =
            v21Text(
              value.Unité,
              'Unité',
              20
            )

          if (
            !V21_UNITS.has(
              unit
            )
          ) {
            throw new Error(
              `Unité inconnue « ${unit} »`
            )
          }

          const effectiveFrom =
            v21Day(
              value.DateEffet,
              'DateEffet'
            )

          return {
            id:
              v21Id(
                value.ID,
                'ID de périodicité'
              ),

            type,

            montant:
              v21Amount(
                value.Montant,
                'Montant',
                {
                  positive: true,
                }
              ),

            banque,

            ...(type ===
            FLOWS.TRANSFER
              ? {
                  banqueDest,
                }
              : {}),

            categoryId,

            description:
              v21Text(
                value.Description,
                'Description',
                2000,
                false
              ),

            startDate,

            ...(endDate
              ? {
                  endDate,
                }
              : {}),

            interval,

            unit,

            active:
              v21Boolean(
                value.Active,
                'Active'
              ),

            effectiveFrom,
          }
        } catch (error) {
          throw new Error(
            `Transactions périodiques ligne ${line} : ${error.message}`
          )
        }
      }
    )

  v21UniqueIds(
    recurringRules,
    'Transactions périodiques'
  )


  /*
   * Toute occurrence périodique exportée
   * doit référencer une règle réellement
   * présente dans le même fichier.
   */
  const recurringRuleIds =
    new Set(
      recurringRules.map(
        rule => rule.id
      )
    )

  for (
    const transaction
    of transactions
  ) {
    if (
      transaction.recurringRuleId &&
      !recurringRuleIds.has(
        transaction.recurringRuleId
      )
    ) {
      throw new Error(
        `Transactions : la règle périodique « ${transaction.recurringRuleId} » référencée par « ${transaction.id} » est introuvable`
      )
    }
  }


  return {
    accounts,
    initialBalances,
    categories,
    transactions,
    recurringRules,
  }
}
