import { FLOWS, ROLE_IDS } from './categoryRoles.js'

export const FINANCE_GROUPS = Object.freeze([
  {
    id: 'charges',
    name: 'Charges',
    color: '#3e9950',
    limit: 50,
  },
  {
    id: 'savings',
    name: 'Épargne',
    color: '#d58b46',
    limit: 20,
  },
  {
    id: 'fun',
    name: 'Plaisirs',
    color: '#598dc4',
    limit: 30,
  },
])

const cents = value =>
  Math.round(Number(value || 0) * 100)

function categoryFor(transaction, categories) {
  return (
    categories.find(
      category => category.id === transaction.categoryId
    ) ||
    categories.find(
      category => category.nom === transaction.categorie
    ) ||
    null
  )
}

function detailAdd(map, category, amountCents) {
  const key =
    category?.id ||
    category?.nom ||
    'unknown'

  const current = map.get(key) || {
    categoryId: category?.id || null,
    name: category?.nom || 'Non classé',
    amountCents: 0,
  }

  current.amountCents += amountCents
  map.set(key, current)
}

export function financeSummary(
  transactions,
  categories = []
) {
  let incomeCents = 0
  let savingsCents = 0
  let chargesCents = 0
  let funCents = 0
  let unclassifiedCents = 0

  const details = {
    savings: new Map(),
    charges: new Map(),
    fun: new Map(),
  }

  for (const transaction of transactions) {
    const category = categoryFor(
      transaction,
      categories
    )

    const roleId = category?.roleId
    const amount = cents(transaction.montant)

    /*
     * ENTRÉES
     *
     * Toutes les opérations Entrée
     * +
     * les transferts Retrait d'épargne.
     */
    if (transaction.type === FLOWS.INCOME) {
      incomeCents += amount
    }

    if (
      transaction.type === FLOWS.TRANSFER &&
      roleId === ROLE_IDS.SAVINGS_WITHDRAWAL
    ) {
      incomeCents += amount
    }

    /*
     * ÉPARGNE POSITIVE
     *
     * Entrée + Économie
     * Entrée + Investissement
     * Transfert + Économie
     * Transfert + Investissement
     */
    if (
      (
        transaction.type === FLOWS.INCOME ||
        transaction.type === FLOWS.TRANSFER
      ) &&
      (
        roleId === ROLE_IDS.SAVINGS ||
        roleId === ROLE_IDS.INVESTMENT
      )
    ) {
      savingsCents += amount

      detailAdd(
        details.savings,
        category,
        amount
      )
    }

    /*
     * RETRAIT D'ÉPARGNE
     */
    if (
      transaction.type === FLOWS.TRANSFER &&
      roleId === ROLE_IDS.SAVINGS_WITHDRAWAL
    ) {
      savingsCents -= amount

      detailAdd(
        details.savings,
        category,
        -amount
      )
    }

    /*
     * CHARGES
     */
    if (
      transaction.type === FLOWS.EXPENSE &&
      roleId === ROLE_IDS.CHARGES
    ) {
      chargesCents += amount

      detailAdd(
        details.charges,
        category,
        amount
      )
    }

    /*
     * PLAISIRS
     */
    if (
      transaction.type === FLOWS.EXPENSE &&
      roleId === ROLE_IDS.FUN
    ) {
      funCents += amount

      detailAdd(
        details.fun,
        category,
        amount
      )
    }

    /*
     * Une Sortie V2.1 valide doit obligatoirement
     * être Charges ou Plaisirs.
     *
     * On conserve toutefois ce compteur comme
     * garde-fou contre une donnée incohérente.
     */
    if (
      transaction.type === FLOWS.EXPENSE &&
      roleId !== ROLE_IDS.CHARGES &&
      roleId !== ROLE_IDS.FUN
    ) {
      unclassifiedCents += amount
    }
  }

  const normalizeDetails = map =>
    [...map.values()]
      .map(item => ({
        categoryId: item.categoryId,
        name: item.name,
        amount: item.amountCents / 100,
      }))
      .sort(
        (a, b) =>
          Math.abs(b.amount) -
          Math.abs(a.amount)
      )

  const normalizedDetails = {
    savings: normalizeDetails(details.savings),
    charges: normalizeDetails(details.charges),
    fun: normalizeDetails(details.fun),
  }

  const values = {
    charges: chargesCents,
    savings: savingsCents,
    fun: funCents,
  }

  const groups = FINANCE_GROUPS.map(group => {
    const valueCents = values[group.id]

    const percent =
      incomeCents > 0
        ? valueCents / incomeCents * 100
        : null

    const ok =
      percent === null
        ? null
        : group.id === 'savings'
          ? valueCents * 100 >
            incomeCents * group.limit
          : valueCents * 100 <
            incomeCents * group.limit

    return {
      ...group,
      value: valueCents / 100,
      percent,
      ok,
      details: normalizedDetails[group.id],
    }
  })

  return {
    income: incomeCents / 100,
    savings: savingsCents / 100,
    charges: chargesCents / 100,
    fun: funCents / 100,
    unclassified: unclassifiedCents / 100,
    groups,
    details: normalizedDetails,
  }
}
