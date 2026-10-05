import test from 'node:test'
import assert from 'node:assert/strict'

import {
  RECURRENCE_UNITS,
  occurrenceDates,
  recurringOccurrenceId,
  planRecurringOccurrences,
} from '../src/domain/recurring.js'

import {
  FLOWS,
  ROLE_IDS,
} from '../src/domain/categoryRoles.js'

test('monthly recurrence keeps the original day and clamps to the last day of shorter months', () => {
  const dates =
    occurrenceDates(
      {
        active: true,
        startDate:
          '2027-01-31',
        unit:
          RECURRENCE_UNITS.MONTH,
        interval: 1,
      },
      '2027-05-31'
    )

  assert.deepEqual(
    dates,
    [
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
      '2027-05-31',
    ]
  )
})

test('yearly leap-day recurrence returns to February 29 on leap years', () => {
  const dates =
    occurrenceDates(
      {
        active: true,
        startDate:
          '2024-02-29',
        unit:
          RECURRENCE_UNITS.YEAR,
        interval: 1,
      },
      '2028-02-29'
    )

  assert.deepEqual(
    dates,
    [
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]
  )
})

test('custom recurrence supports every two weeks and deterministic occurrence ids', () => {
  const dates =
    occurrenceDates(
      {
        active: true,
        startDate:
          '2027-01-01',
        unit:
          RECURRENCE_UNITS.WEEK,
        interval: 2,
      },
      '2027-02-01'
    )

  assert.deepEqual(
    dates,
    [
      '2027-01-01',
      '2027-01-15',
      '2027-01-29',
    ]
  )

  assert.equal(
    recurringOccurrenceId(
      'salary-rule',
      '2027-01-15'
    ),
    'periodic_salary-rule_2027-01-15'
  )
})

test('recurring planner creates real income expense and transfer transactions without duplicates', () => {
  const accounts = [
    { id: 'main' },
    { id: 'savings' },
  ]

  const categories = [
    {
      id: 'salary',
      nom: 'Salaire',
      roleId:
        ROLE_IDS.SALARY,
    },
    {
      id: 'charges',
      nom: 'Loyer',
      roleId:
        ROLE_IDS.CHARGES,
    },
    {
      id: 'save',
      nom: 'Livret',
      roleId:
        ROLE_IDS.SAVINGS,
    },
  ]

  const rules = [
    {
      id: 'income',
      active: true,
      type:
        FLOWS.INCOME,
      montant: 2500,
      banque: 'main',
      categoryId: 'salary',
      description:
        'Salaire périodique',
      startDate:
        '2027-01-05',
      unit:
        RECURRENCE_UNITS.MONTH,
      interval: 1,
    },
    {
      id: 'rent',
      active: true,
      type:
        FLOWS.EXPENSE,
      montant: 800,
      banque: 'main',
      categoryId: 'charges',
      description:
        'Loyer',
      startDate:
        '2027-01-10',
      unit:
        RECURRENCE_UNITS.MONTH,
      interval: 1,
    },
    {
      id: 'saving',
      active: true,
      type:
        FLOWS.TRANSFER,
      montant: 300,
      banque: 'main',
      banqueDest:
        'savings',
      categoryId: 'save',
      description:
        'Épargne mensuelle',
      startDate:
        '2027-01-15',
      unit:
        RECURRENCE_UNITS.MONTH,
      interval: 1,
    },
  ]

  const transactions = [
    {
      id:
        'periodic_income_2027-01-05',
    },
  ]

  const planned =
    planRecurringOccurrences({
      rules,
      transactions,
      categories,
      accounts,
      throughDate:
        '2027-01-31',
    })

  assert.deepEqual(
    planned.map(
      row => row.id
    ),
    [
      'periodic_rent_2027-01-10',
      'periodic_saving_2027-01-15',
    ]
  )

  assert.equal(
    planned[0].data.type,
    FLOWS.EXPENSE
  )

  assert.equal(
    planned[1].data.type,
    FLOWS.TRANSFER
  )

  assert.equal(
    planned[1].data.banqueDest,
    'savings'
  )

  assert.equal(
    planned[1].data.recurringRuleId,
    'saving'
  )
})
