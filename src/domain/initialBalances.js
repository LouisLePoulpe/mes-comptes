import { calculateAmount } from './amount.js'
import { accountMovements } from './movements.js'

const toCents = value =>
  Math.round(Number(value || 0) * 100)

export function calculateInitialAmount(input) {
  const text = String(input ?? '').trim()

  if (!text) {
    throw new Error('Saisis un montant.')
  }

  const negative = text.startsWith('-')
  const expression = negative
    ? text.slice(1)
    : text

  const amount = calculateAmount(expression)

  return negative
    ? -amount
    : amount
}

function validTimestamp(value) {
  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp)
    ? timestamp
    : null
}

export function accountBalancesAt(
  accounts,
  transactions,
  initialBalances,
  cutoffTimestamp = Infinity
) {
  const cents = Object.fromEntries(
    accounts.map(account => [
      account.id,
      0,
    ])
  )

  for (const initial of initialBalances) {
    const timestamp =
      validTimestamp(initial.date)

    if (
      timestamp === null ||
      timestamp > cutoffTimestamp
    ) {
      continue
    }

    cents[initial.accountId] =
      (cents[initial.accountId] || 0) +
      toCents(initial.amount)
  }

  for (const transaction of transactions) {
    const timestamp =
      validTimestamp(transaction.date)

    if (
      timestamp === null ||
      timestamp > cutoffTimestamp
    ) {
      continue
    }

    for (
      const [accountId, amount]
      of accountMovements(transaction)
    ) {
      cents[accountId] =
        (cents[accountId] || 0) +
        toCents(amount)
    }
  }

  return Object.fromEntries(
    Object.entries(cents).map(
      ([accountId, value]) => [
        accountId,
        value / 100,
      ]
    )
  )
}

export function accountTimeline(
  accounts,
  transactions,
  initialBalances
) {
  const eventsByDay = new Map()

  const addEvent = (
    date,
    movements
  ) => {
    const timestamp =
      validTimestamp(date)

    if (timestamp === null) return

    const day =
      new Date(timestamp)
        .toISOString()
        .slice(0, 10)

    const events =
      eventsByDay.get(day) || []

    events.push(movements)
    eventsByDay.set(day, events)
  }

  for (const initial of initialBalances) {
    addEvent(
      initial.date,
      [[
        initial.accountId,
        initial.amount,
      ]]
    )
  }

  for (const transaction of transactions) {
    addEvent(
      transaction.date,
      accountMovements(transaction)
    )
  }

  const running =
    Object.fromEntries(
      accounts.map(account => [
        account.id,
        0,
      ])
    )

  const rows = []

  for (
    const day
    of [...eventsByDay.keys()].sort()
  ) {
    for (
      const movements
      of eventsByDay.get(day)
    ) {
      for (
        const [accountId, amount]
        of movements
      ) {
        running[accountId] =
          (running[accountId] || 0) +
          amount
      }
    }

    const timestamp =
      Date.parse(
        `${day}T00:00:00.000Z`
      )

    rows.push({
      date:
        new Date(timestamp)
          .toLocaleDateString(
            'fr-FR',
            { timeZone: 'UTC' }
          ),

      timestamp,

      ...Object.fromEntries(
        Object.entries(running).map(
          ([accountId, value]) => [
            accountId,
            Math.round(value * 100) / 100,
          ]
        )
      ),
    })
  }

  return rows
}
