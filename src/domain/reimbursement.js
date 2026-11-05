import { FLOWS } from './categoryRoles.js'

export const REIMBURSED_BY_MAX_LENGTH = 100

// Une dépense (Sortie) remboursée garde son montant d'origine dans les données,
// mais compte pour 0 partout : solde des comptes, courbes, Charges et Plaisirs.
export const isReimbursed = transaction =>
  transaction?.type === FLOWS.EXPENSE &&
  Boolean(transaction.reimbursedAt)

export const effectiveAmount = transaction =>
  isReimbursed(transaction) ? 0 : transaction.montant

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
// remboursée (les champs sont alors absents, jamais vides), sinon date + personne.
export function reimbursementFields(type, { reimbursedAt = '', reimbursedBy = '' } = {}) {
  const day = String(reimbursedAt ?? '').trim()
  const by = String(reimbursedBy ?? '').trim()
  if (!day && !by) return {}
  if (type !== FLOWS.EXPENSE) {
    throw new Error('Seule une dépense (Sortie) peut être remboursée.')
  }
  if (!validDay(day)) throw new Error('Choisis la date du remboursement.')
  if (!by) throw new Error('Indique par qui la dépense a été remboursée.')
  if (by.length > REIMBURSED_BY_MAX_LENGTH) {
    throw new Error(`« Remboursée par » est limité à ${REIMBURSED_BY_MAX_LENGTH} caractères.`)
  }
  return { reimbursedAt: day, reimbursedBy: by }
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
