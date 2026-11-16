import { FLOWS } from './categoryRoles.js'
import { calculateAmount } from './amount.js'

export const REIMBURSED_BY_MAX_LENGTH = 100

// Une dépense (Sortie) remboursée garde son montant d'origine dans les données.
// Sans `reimbursedAmount`, elle est remboursée en entier et compte pour 0 partout
// (solde des comptes, courbes, Charges et Plaisirs). Avec un montant partiel, seule
// la différence reste à la charge de l'utilisateur.
export const isReimbursed = transaction =>
  transaction?.type === FLOWS.EXPENSE &&
  Boolean(transaction.reimbursedAt)

const toCents = value => Math.round(Number(value) * 100)

// Montant effectivement remboursé (le total de la dépense s'il n'est pas précisé).
export function refundedAmount(transaction) {
  if (!isReimbursed(transaction)) return 0
  const refunded = Number(transaction.reimbursedAmount)
  if (!(refunded > 0)) return transaction.montant
  return Math.min(toCents(refunded), toCents(transaction.montant)) / 100
}

export const isPartiallyReimbursed = transaction =>
  isReimbursed(transaction) &&
  refundedAmount(transaction) < transaction.montant

// Ce qui reste à la charge de l'utilisateur : base de tous les calculs.
export const effectiveAmount = transaction =>
  isReimbursed(transaction)
    ? (toCents(transaction.montant) - toCents(refundedAmount(transaction))) / 100
    : transaction.montant

function validDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

// Champs à enregistrer dans la transaction : objet vide si elle n'est pas
// remboursée (les champs sont alors absents, jamais vides), sinon date + personne
// et, si le remboursement est partiel, son montant. Un montant égal à la dépense
// (ou laissé vide) signifie « remboursée en entier » et n'est pas enregistré.
export function reimbursementFields(
  type,
  { reimbursedAt = '', reimbursedBy = '', reimbursedAmount = '' } = {},
  montant
) {
  const day = String(reimbursedAt ?? '').trim()
  const by = String(reimbursedBy ?? '').trim()
  const amountText = String(reimbursedAmount ?? '').trim()
  if (!day && !by && !amountText) return {}
  if (type !== FLOWS.EXPENSE) {
    throw new Error('Seule une dépense (Sortie) peut être remboursée.')
  }
  if (!validDay(day)) throw new Error('Choisis la date du remboursement.')
  if (!by) throw new Error('Indique par qui la dépense a été remboursée.')
  if (by.length > REIMBURSED_BY_MAX_LENGTH) {
    throw new Error(`« Remboursée par » est limité à ${REIMBURSED_BY_MAX_LENGTH} caractères.`)
  }
  const fields = { reimbursedAt: day, reimbursedBy: by }
  if (!amountText) return fields

  const refunded = calculateAmount(amountText)
  if (!(Number(montant) > 0)) {
    throw new Error('Indique le montant de la dépense avant celui du remboursement.')
  }
  if (toCents(refunded) > toCents(montant)) {
    throw new Error(`Le montant remboursé ne peut pas dépasser la dépense (${montant} €).`)
  }
  return toCents(refunded) === toCents(montant)
    ? fields
    : { ...fields, reimbursedAmount: refunded }
}

// Noms déjà utilisés, les plus fréquents d'abord, pour proposer des suggestions.
export function reimbursers(transactions) {
  const counts = new Map()
  for (const transaction of transactions) {
    const name = String(transaction?.reimbursedBy ?? '').trim()
    if (!name || !transaction.reimbursedAt) continue
    const key = name.toLocaleLowerCase('fr')
    const known = counts.get(key)
    if (known) known.count += 1
    else counts.set(key, { name, count: 1 })
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))
    .map(entry => entry.name)
}
