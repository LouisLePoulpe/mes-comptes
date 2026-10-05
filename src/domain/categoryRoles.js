export const FLOWS = Object.freeze({
  INCOME: 'Entrée',
  EXPENSE: 'Sortie',
  TRANSFER: 'Transfert',
})

export const ROLE_IDS = Object.freeze({
  SALARY: 'salary',
  AID: 'aid',
  GIFT: 'gift',
  SAVINGS: 'savings',
  INVESTMENT: 'investment',
  FUN: 'fun',
  CHARGES: 'charges',
  NEUTRAL_TRANSFER: 'neutralTransfer',
  SAVINGS_WITHDRAWAL: 'savingsWithdrawal',
})

export const CATEGORY_ROLES = Object.freeze([
  { id: ROLE_IDS.SALARY, name: 'Salaire 💶', flows: [FLOWS.INCOME] },
  { id: ROLE_IDS.AID, name: 'Aides 🥖', flows: [FLOWS.INCOME] },
  { id: ROLE_IDS.GIFT, name: 'Dons 🎁', flows: [FLOWS.INCOME] },
  { id: ROLE_IDS.SAVINGS, name: 'Économie 🏦', flows: [FLOWS.INCOME, FLOWS.TRANSFER] },
  { id: ROLE_IDS.INVESTMENT, name: 'Investissement 📈', flows: [FLOWS.INCOME, FLOWS.TRANSFER] },
  { id: ROLE_IDS.FUN, name: 'Plaisir 🥳', flows: [FLOWS.EXPENSE] },
  { id: ROLE_IDS.CHARGES, name: 'Charges 💸', flows: [FLOWS.EXPENSE] },
  { id: ROLE_IDS.NEUTRAL_TRANSFER, name: 'Transfert neutre 🔄', flows: [FLOWS.TRANSFER] },
  { id: ROLE_IDS.SAVINGS_WITHDRAWAL, name: "Retrait d'épargne 💰", flows: [FLOWS.TRANSFER] },
])

const ROLE_BY_ID = new Map(CATEGORY_ROLES.map(role => [role.id, role]))

export function roleById(roleId) {
  return ROLE_BY_ID.get(roleId) || null
}

export function isRoleAllowedForFlow(roleId, flow) {
  return roleById(roleId)?.flows.includes(flow) === true
}

export function rolesForFlow(flow) {
  return CATEGORY_ROLES.filter(role => role.flows.includes(flow))
}

export function assertCategoryFlow(category, flow) {
  if (!category?.roleId) {
    throw new Error('La catégorie doit être associée à un rôle de calcul.')
  }

  if (!isRoleAllowedForFlow(category.roleId, flow)) {
    throw new Error(
      `La catégorie « ${category.nom || 'Sans nom'} » n'est pas compatible avec le flux « ${flow} ».`
    )
  }

  return true
}

export const DEFAULT_CATEGORIES_V21 = CATEGORY_ROLES.map(role => ({
  id: `default_${role.id}`,
  nom: role.name,
  roleId: role.id,
  defaultRole: true,
}))
