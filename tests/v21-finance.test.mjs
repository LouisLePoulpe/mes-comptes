import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CATEGORY_ROLES,
  DEFAULT_CATEGORIES_V21,
  FLOWS,
  ROLE_IDS,
  assertCategoryFlow,
  isRoleAllowedForFlow,
  rolesForFlow,
} from '../src/domain/categoryRoles.js'

import { financeSummary } from '../src/domain/finance.js'

test('V2.1 exposes exactly three immutable flows and nine calculation roles', () => {
  assert.deepEqual(Object.values(FLOWS), [
    'Entrée',
    'Sortie',
    'Transfert',
  ])

  assert.equal(CATEGORY_ROLES.length, 9)
  assert.equal(DEFAULT_CATEGORIES_V21.length, 9)
})

test('roles are available only in their allowed flows', () => {
  assert.deepEqual(
    rolesForFlow(FLOWS.INCOME).map(role => role.id),
    [
      ROLE_IDS.SALARY,
      ROLE_IDS.AID,
      ROLE_IDS.GIFT,
      ROLE_IDS.SAVINGS,
      ROLE_IDS.INVESTMENT,
    ]
  )

  assert.deepEqual(
    rolesForFlow(FLOWS.EXPENSE).map(role => role.id),
    [
      ROLE_IDS.FUN,
      ROLE_IDS.CHARGES,
    ]
  )

  assert.deepEqual(
    rolesForFlow(FLOWS.TRANSFER).map(role => role.id),
    [
      ROLE_IDS.SAVINGS,
      ROLE_IDS.INVESTMENT,
      ROLE_IDS.NEUTRAL_TRANSFER,
      ROLE_IDS.SAVINGS_WITHDRAWAL,
    ]
  )

  assert.equal(
    isRoleAllowedForFlow(ROLE_IDS.CHARGES, FLOWS.INCOME),
    false
  )

  assert.throws(
    () =>
      assertCategoryFlow(
        { nom: 'Loyer', roleId: ROLE_IDS.CHARGES },
        FLOWS.INCOME
      ),
    /pas compatible/
  )
})

test('V2.1 finance rules match the agreed formulas', () => {
  const categories = [
    { id: 'salary', nom: 'Salaire', roleId: ROLE_IDS.SALARY },
    { id: 'gift', nom: 'Mamie', roleId: ROLE_IDS.GIFT },
    { id: 'livret', nom: 'Livret A', roleId: ROLE_IDS.SAVINGS },
    { id: 'etf', nom: 'ETF', roleId: ROLE_IDS.INVESTMENT },
    { id: 'rent', nom: 'Loyer', roleId: ROLE_IDS.CHARGES },
    { id: 'restaurant', nom: 'Restaurant', roleId: ROLE_IDS.FUN },
    {
      id: 'neutral',
      nom: 'Virement interne',
      roleId: ROLE_IDS.NEUTRAL_TRANSFER,
    },
    {
      id: 'withdrawal',
      nom: "Retrait d'épargne",
      roleId: ROLE_IDS.SAVINGS_WITHDRAWAL,
    },
  ]

  const transactions = [
    { type: FLOWS.INCOME, montant: 2000, categoryId: 'salary' },
    { type: FLOWS.INCOME, montant: 100, categoryId: 'gift' },
    { type: FLOWS.INCOME, montant: 50, categoryId: 'livret' },

    { type: FLOWS.TRANSFER, montant: 300, categoryId: 'livret' },
    { type: FLOWS.TRANSFER, montant: 200, categoryId: 'etf' },
    { type: FLOWS.TRANSFER, montant: 40, categoryId: 'neutral' },

    {
      type: FLOWS.TRANSFER,
      montant: 80,
      categoryId: 'withdrawal',
    },

    { type: FLOWS.EXPENSE, montant: 700, categoryId: 'rent' },
    { type: FLOWS.EXPENSE, montant: 90, categoryId: 'restaurant' },
  ]

  const result = financeSummary(transactions, categories)

  assert.equal(result.income, 2230)
  assert.equal(result.savings, 470)
  assert.equal(result.charges, 700)
  assert.equal(result.fun, 90)

  assert.deepEqual(
    result.details.savings.map(row => [row.name, row.amount]),
    [
      ['Livret A', 350],
      ['ETF', 200],
      ["Retrait d'épargne", -80],
    ]
  )

  assert.deepEqual(
    result.details.charges.map(row => [row.name, row.amount]),
    [['Loyer', 700]]
  )

  assert.deepEqual(
    result.details.fun.map(row => [row.name, row.amount]),
    [['Restaurant', 90]]
  )
})

test('custom categories inherit calculations from their role without bank semantics', () => {
  const categories = [
    {
      id: 'etf-world',
      nom: 'ETF Monde 🌍',
      roleId: ROLE_IDS.INVESTMENT,
    },
    {
      id: 'groceries',
      nom: 'Courses 🛒',
      roleId: ROLE_IDS.CHARGES,
    },
  ]

  const result = financeSummary(
    [
      {
        type: FLOWS.INCOME,
        montant: 120,
        categoryId: 'etf-world',
        banque: 'any-account',
      },
      {
        type: FLOWS.EXPENSE,
        montant: 60,
        categoryId: 'groceries',
        banque: 'same-account',
      },
    ],
    categories
  )

  assert.equal(result.income, 120)
  assert.equal(result.savings, 120)
  assert.equal(result.charges, 60)
  assert.equal(result.details.savings[0].name, 'ETF Monde 🌍')
})
