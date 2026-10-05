import { FLOWS, ROLE_IDS } from './categoryRoles.js'

const cents = value => Math.round(Number(value || 0) * 100)

function categoryFor(transaction, categories) {
  return (
    categories.find(category => category.id === transaction.categoryId) ||
    categories.find(category => category.nom === transaction.categorie) ||
    null
  )
}

function detailAdd(map, category, amountCents) {
  const key = category?.id || category?.nom || 'unknown'

  const current = map.get(key) || {
    categoryId: category?.id || null,
    name: category?.nom || 'Non classé',
    amountCents: 0,
  }

  current.amountCents += amountCents
  map.set(key, current)
}

export function financeSummary(transactions, categories = []) {
  let incomeCents = 0
  let savingsCents = 0
  let chargesCents = 0
  let funCents = 0

  const details = {
    savings: new Map(),
    charges: new Map(),
    fun: new Map(),
  }

  for (const transaction of transactions) {
    const category = categoryFor(transaction, categories)
    const roleId = category?.roleId
    const amount = cents(transaction.montant)

    // Entrées = toutes les entrées + retraits d'épargne.
    if (transaction.type === FLOWS.INCOME) {
      incomeCents += amount
    }

    if (
      transaction.type === FLOWS.TRANSFER &&
      roleId === ROLE_IDS.SAVINGS_WITHDRAWAL
    ) {
      incomeCents += amount
    }

    // Épargne positive.
    if (
      (transaction.type === FLOWS.INCOME ||
        transaction.type === FLOWS.TRANSFER) &&
      (roleId === ROLE_IDS.SAVINGS ||
        roleId === ROLE_IDS.INVESTMENT)
    ) {
      savingsCents += amount
      detailAdd(details.savings, category, amount)
    }

    // Retrait d'épargne.
    if (
      transaction.type === FLOWS.TRANSFER &&
      roleId === ROLE_IDS.SAVINGS_WITHDRAWAL
    ) {
      savingsCents -= amount
      detailAdd(details.savings, category, -amount)
    }

    if (
      transaction.type === FLOWS.EXPENSE &&
      roleId === ROLE_IDS.CHARGES
    ) {
      chargesCents += amount
      detailAdd(details.charges, category, amount)
    }

    if (
      transaction.type === FLOWS.EXPENSE &&
      roleId === ROLE_IDS.FUN
    ) {
      funCents += amount
      detailAdd(details.fun, category, amount)
    }
  }

  const normalizeDetails = map =>
    [...map.values()]
      .map(item => ({
        ...item,
        amount: item.amountCents / 100,
      }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  return {
    income: incomeCents / 100,
    savings: savingsCents / 100,
    charges: chargesCents / 100,
    fun: funCents / 100,

    details: {
      savings: normalizeDetails(details.savings),
      charges: normalizeDetails(details.charges),
      fun: normalizeDetails(details.fun),
    },
  }
}
