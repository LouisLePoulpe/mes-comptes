export const BUDGET_GROUPS = [
  { id: 'charges', name: 'Charges', color: '#56a477', limit: 50 },
  { id: 'savings', name: 'Épargne', color: '#d99b4a', limit: 20 },
  { id: 'fun', name: 'Plaisirs', color: '#648fca', limit: 30 },
]
export const categoryGroup = category => {
  if (category?.budgetGroup !== undefined) return category.budgetGroup
  const name = (category?.nom || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  if (name.includes('epargne')) return name.includes('retrait') ? 'savingsWithdrawal' : 'savings'
  if (name.includes('charge')) return 'charges'
  if (name.includes('plaisir')) return 'fun'
  return 'none'
}
export function budgetSummary(transactions, categories) {
  const amounts = { charges: 0, savings: 0, fun: 0 }
  let income = 0, unclassified = 0
  for (const row of transactions) {
    const group = categoryGroup(categories.find(c => c.nom === row.categorie) || { nom: row.categorie })
    const cents = Math.round(row.montant * 100)
    if (row.type === 'Entrée') { if (group === 'savingsWithdrawal') amounts.savings -= cents; else income += cents; continue }
    if (group === 'savingsWithdrawal') amounts.savings -= cents
    else if (group in amounts) amounts[group] += cents
    else if (row.type === 'Sortie') unclassified += cents
  }
  return { income: income / 100, unclassified: unclassified / 100,
    groups: BUDGET_GROUPS.map(group => {
      const cents = amounts[group.id]
      const percent = income > 0 ? cents / income * 100 : null
      const ok = percent === null ? null : group.id === 'savings' ? cents * 100 > income * 20 : cents * 100 < income * group.limit
      return { ...group, value: cents / 100, percent, ok }
    }) }
}
export const DEFAULT_CATEGORIES = BUDGET_GROUPS.map(group => ({ id: `default_${group.id}`, nom: group.name, budgetGroup: group.id }))
