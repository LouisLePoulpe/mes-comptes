import test from 'node:test'
import assert from 'node:assert/strict'

import {
  accountBalancesAt,
  accountTimeline,
  calculateInitialAmount,
} from '../src/domain/initialBalances.js'

test('initial amounts accept positive and negative values safely', () => {
  assert.equal(
    calculateInitialAmount('22 950'),
    22950
  )

  assert.equal(
    calculateInitialAmount('-250,50'),
    -250.5
  )

  assert.equal(
    calculateInitialAmount(
      '1000 + 817'
    ),
    1817
  )
})

test('multiple initial amounts affect account balances but remain independent records', () => {
  const accounts = [
    { id: 'cmb' },
    { id: 'tr' },
  ]

  const initialBalances = [
    {
      id: 'livret-a',
      accountId: 'cmb',
      label: 'Livret A',
      amount: 22950,
      date:
        '2025-11-01T00:00:00.000Z',
    },
    {
      id: 'livret-jeune',
      accountId: 'cmb',
      label: 'Livret Jeune',
      amount: 1817,
      date:
        '2025-11-01T00:00:00.000Z',
    },
    {
      id: 'ldds',
      accountId: 'cmb',
      label: 'LDDS',
      amount: 511,
      date:
        '2025-11-01T00:00:00.000Z',
    },
    {
      id: 'tr-start',
      accountId: 'tr',
      label: 'Solde initial',
      amount: 480,
      date:
        '2025-11-01T00:00:00.000Z',
    },
  ]

  const balances =
    accountBalancesAt(
      accounts,
      [],
      initialBalances
    )

  assert.equal(
    balances.cmb,
    25278
  )

  assert.equal(
    balances.tr,
    480
  )
})

test('initial amounts enter the graph on their effective date and transactions continue from them', () => {
  const accounts = [
    { id: 'cmb' },
  ]

  const initialBalances = [
    {
      id: 'start',
      accountId: 'cmb',
      label: 'Départ',
      amount: 1000,
      date:
        '2025-11-01T00:00:00.000Z',
    },
    {
      id: 'second',
      accountId: 'cmb',
      label: 'Deuxième montant',
      amount: 500,
      date:
        '2025-11-10T00:00:00.000Z',
    },
  ]

  const transactions = [
    {
      type: 'Sortie',
      montant: 100,
      banque: 'cmb',
      date:
        '2025-11-05T00:00:00.000Z',
    },
    {
      type: 'Entrée',
      montant: 200,
      banque: 'cmb',
      date:
        '2025-11-15T00:00:00.000Z',
    },
  ]

  const timeline =
    accountTimeline(
      accounts,
      transactions,
      initialBalances
    )

  assert.deepEqual(
    timeline.map(
      row => row.cmb
    ),
    [
      1000,
      900,
      1400,
      1600,
    ]
  )

  const beforeSecond =
    accountBalancesAt(
      accounts,
      transactions,
      initialBalances,
      Date.parse(
        '2025-11-09T23:59:59.999Z'
      )
    )

  assert.equal(
    beforeSecond.cmb,
    900
  )
})
