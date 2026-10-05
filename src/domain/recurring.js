import {
  FLOWS,
  assertCategoryFlow,
} from './categoryRoles.js'

export const RECURRENCE_UNITS =
  Object.freeze({
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year',
  })

const UNITS =
  new Set(
    Object.values(
      RECURRENCE_UNITS
    )
  )

function normalizeDay(value) {
  const text =
    String(value || '')

  const direct =
    /^(\d{4})-(\d{2})-(\d{2})/
      .exec(text)

  if (direct) {
    const day =
      `${direct[1]}-${direct[2]}-${direct[3]}`

    const date =
      new Date(
        `${day}T00:00:00.000Z`
      )

    if (
      !Number.isNaN(
        date.getTime()
      ) &&
      date.toISOString()
        .slice(0, 10) === day
    ) {
      return day
    }
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      'Date périodique invalide.'
    )
  }

  return date
    .toISOString()
    .slice(0, 10)
}

function parts(day) {
  const [year, month, date] =
    day
      .split('-')
      .map(Number)

  return {
    year,
    month,
    date,
  }
}

function daysInMonth(
  year,
  month
) {
  return new Date(
    Date.UTC(
      year,
      month,
      0
    )
  ).getUTCDate()
}

function formatDay(
  year,
  month,
  date
) {
  return [
    String(year)
      .padStart(4, '0'),
    String(month)
      .padStart(2, '0'),
    String(date)
      .padStart(2, '0'),
  ].join('-')
}

function addDays(
  startDay,
  amount
) {
  const timestamp =
    Date.parse(
      `${startDay}T00:00:00.000Z`
    )

  return new Date(
    timestamp +
    amount *
      24 *
      60 *
      60 *
      1000
  )
    .toISOString()
    .slice(0, 10)
}

function monthOccurrence(
  startDay,
  offset
) {
  const start =
    parts(startDay)

  const monthIndex =
    start.year * 12 +
    (start.month - 1) +
    offset

  const year =
    Math.floor(
      monthIndex / 12
    )

  const month =
    monthIndex % 12 + 1

  const date =
    Math.min(
      start.date,
      daysInMonth(
        year,
        month
      )
    )

  return formatDay(
    year,
    month,
    date
  )
}

function yearOccurrence(
  startDay,
  offset
) {
  const start =
    parts(startDay)

  const year =
    start.year + offset

  const date =
    Math.min(
      start.date,
      daysInMonth(
        year,
        start.month
      )
    )

  return formatDay(
    year,
    start.month,
    date
  )
}

export function recurringOccurrenceId(
  ruleId,
  day
) {
  if (
    typeof ruleId !== 'string' ||
    !ruleId ||
    ruleId.includes('/')
  ) {
    throw new Error(
      'Identifiant périodique invalide.'
    )
  }

  return (
    `periodic_${ruleId}_` +
    normalizeDay(day)
  )
}

export function occurrenceDates(
  rule,
  throughDate
) {
  if (
    rule.active === false
  ) {
    return []
  }

  const start =
    normalizeDay(
      rule.startDate
    )

  const through =
    normalizeDay(
      throughDate
    )

  const end =
    rule.endDate
      ? normalizeDay(
          rule.endDate
        )
      : through

  const last =
    end < through
      ? end
      : through

  if (last < start) {
    return []
  }

  const interval =
    Number(
      rule.interval ?? 1
    )

  if (
    !Number.isInteger(
      interval
    ) ||
    interval < 1 ||
    interval > 10000
  ) {
    throw new Error(
      'Périodicité invalide.'
    )
  }

  if (
    !UNITS.has(
      rule.unit
    )
  ) {
    throw new Error(
      'Unité de périodicité invalide.'
    )
  }

  const result = []

  for (
    let index = 0;
    index < 5000;
    index++
  ) {
    let day

    if (
      rule.unit ===
      RECURRENCE_UNITS.DAY
    ) {
      day =
        addDays(
          start,
          index * interval
        )
    }

    if (
      rule.unit ===
      RECURRENCE_UNITS.WEEK
    ) {
      day =
        addDays(
          start,
          index *
            interval *
            7
        )
    }

    if (
      rule.unit ===
      RECURRENCE_UNITS.MONTH
    ) {
      day =
        monthOccurrence(
          start,
          index * interval
        )
    }

    if (
      rule.unit ===
      RECURRENCE_UNITS.YEAR
    ) {
      day =
        yearOccurrence(
          start,
          index * interval
        )
    }

    if (day > last) {
      return result
    }

    result.push(day)
  }

  throw new Error(
    'Cette périodicité génère trop d’occurrences.'
  )
}

export function validateRecurringRule(
  rule,
  categories,
  accounts
) {
  if (
    !Object.values(
      FLOWS
    ).includes(
      rule.type
    )
  ) {
    throw new Error(
      'Flux périodique invalide.'
    )
  }

  if (
    !Number.isFinite(
      Number(rule.montant)
    ) ||
    Number(rule.montant) <= 0
  ) {
    throw new Error(
      'Montant périodique invalide.'
    )
  }

  if (
    !accounts.some(
      account =>
        account.id ===
        rule.banque
    )
  ) {
    throw new Error(
      'Compte périodique invalide.'
    )
  }

  const category =
    categories.find(
      current =>
        current.id ===
        rule.categoryId
    )

  if (!category) {
    throw new Error(
      'Catégorie périodique introuvable.'
    )
  }

  assertCategoryFlow(
    category,
    rule.type
  )

  if (
    rule.type ===
    FLOWS.TRANSFER
  ) {
    if (
      !accounts.some(
        account =>
          account.id ===
          rule.banqueDest
      ) ||
      rule.banqueDest ===
        rule.banque
    ) {
      throw new Error(
        'Compte de destination périodique invalide.'
      )
    }
  }

  occurrenceDates(
    {
      ...rule,
      active: true,
    },
    rule.startDate
  )

  if (
    rule.endDate &&
    normalizeDay(
      rule.endDate
    ) <
    normalizeDay(
      rule.startDate
    )
  ) {
    throw new Error(
      'La date de fin précède la date de début.'
    )
  }

  return category
}

export function buildRecurringTransaction(
  rule,
  day,
  category
) {
  const date =
    normalizeDay(day)

  return {
    type: rule.type,
    montant:
      Number(rule.montant),
    banque:
      rule.banque,

    ...(rule.type ===
      FLOWS.TRANSFER
      ? {
          banqueDest:
            rule.banqueDest,
        }
      : {}),

    categoryId:
      category.id,

    categorie:
      category.nom,

    description:
      rule.description || '',

    date:
      `${date}T00:00:00.000Z`,

    recurringRuleId:
      rule.id,

    recurringOccurrence:
      date,
  }
}

export function planRecurringOccurrences({
  rules,
  transactions,
  categories,
  accounts,
  throughDate,
}) {
  const existing =
    new Set(
      transactions.map(
        transaction =>
          transaction.id
      )
    )

  const planned = []

  for (const rule of rules) {
    if (
      rule.active === false
    ) {
      continue
    }

    const category =
      validateRecurringRule(
        rule,
        categories,
        accounts
      )

    for (
      const day
      of occurrenceDates(
        rule,
        throughDate
      )
    ) {
      const id =
        recurringOccurrenceId(
          rule.id,
          day
        )

      if (
        existing.has(id)
      ) {
        continue
      }

      planned.push({
        id,
        data:
          buildRecurringTransaction(
            rule,
            day,
            category
          ),
      })
    }
  }

  planned.sort(
    (a, b) =>
      a.data.date.localeCompare(
        b.data.date
      ) ||
      a.id.localeCompare(b.id)
  )

  return planned
}
