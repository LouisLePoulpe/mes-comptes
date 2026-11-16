import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'

import {
  effectiveAmount,
  isPartiallyReimbursed,
  isReimbursed,
  refundedAmount,
  reimbursementFields,
  reimbursers,
} from '../src/domain/reimbursement.js'
import {
  accountPeriodAmounts,
} from '../src/domain/movements.js'
import {
  accountBalancesAt,
  accountTimeline,
} from '../src/domain/initialBalances.js'
import { financeSummary } from '../src/domain/finance.js'
import { createExportV21 } from '../src/transfer/export.js'
import { parseExportV21 } from '../src/transfer/parse.js'
import { planImportV21 } from '../src/transfer/plan.js'

const reimbursed = {
  reimbursedAt: '2026-11-05',
  reimbursedBy: 'Pierre',
}

test('a reimbursed expense counts for 0, every other operation keeps its amount', () => {
  const expense = { type: 'Sortie', montant: 40 }
  assert.equal(effectiveAmount(expense), 40)
  assert.equal(isReimbursed(expense), false)

  const paidBack = { ...expense, ...reimbursed }
  assert.equal(isReimbursed(paidBack), true)
  assert.equal(effectiveAmount(paidBack), 0)

  // Stale fields on another flow are ignored: only a Sortie can be reimbursed.
  const income = { type: 'Entrée', montant: 40, ...reimbursed }
  assert.equal(isReimbursed(income), false)
  assert.equal(effectiveAmount(income), 40)
})

test('reimbursement fields require a real date and a person, on an expense only', () => {
  assert.deepEqual(reimbursementFields('Sortie', {}), {})
  assert.deepEqual(reimbursementFields('Sortie', { reimbursedAt: '', reimbursedBy: '  ' }), {})
  assert.deepEqual(
    reimbursementFields('Sortie', { reimbursedAt: ' 2026-11-05 ', reimbursedBy: '  Pierre ' }),
    reimbursed
  )
  assert.throws(() => reimbursementFields('Sortie', { reimbursedAt: '2026-11-05' }), /par qui/)
  assert.throws(() => reimbursementFields('Sortie', { reimbursedBy: 'Pierre' }), /date/)
  assert.throws(() => reimbursementFields('Sortie', { reimbursedAt: '2026-02-30', reimbursedBy: 'Pierre' }), /date/)
  assert.throws(() => reimbursementFields('Sortie', { reimbursedAt: '05/11/2026', reimbursedBy: 'Pierre' }), /date/)
  assert.throws(() => reimbursementFields('Entrée', reimbursed), /Sortie/)
  assert.throws(() => reimbursementFields('Transfert', reimbursed), /Sortie/)
  assert.throws(
    () => reimbursementFields('Sortie', { reimbursedAt: '2026-11-05', reimbursedBy: 'x'.repeat(101) }),
    /100 caractères/
  )
})

test('suggestions list the names already used, most frequent first, without duplicates', () => {
  const rows = [
    { reimbursedAt: '2026-10-01', reimbursedBy: 'Mutuelle' },
    { reimbursedAt: '2026-10-02', reimbursedBy: 'Pierre' },
    { reimbursedAt: '2026-10-03', reimbursedBy: 'pierre' },
    { reimbursedAt: '2026-10-04', reimbursedBy: 'KNDS' },
    { reimbursedBy: 'Fantôme' },
    {},
  ]
  assert.deepEqual(reimbursers(rows), ['Pierre', 'KNDS', 'Mutuelle'])
})

test('a reimbursed expense no longer lowers account balances, periods or the timeline', () => {
  const accounts = [{ id: 'bb' }]
  const initialBalances = [{
    id: 'start', accountId: 'bb', label: 'Départ', amount: 1000, date: '2026-10-01T00:00:00.000Z',
  }]
  const transactions = [
    { id: 'a', type: 'Sortie', montant: 100, banque: 'bb', date: '2026-10-05T00:00:00.000Z' },
    { id: 'b', type: 'Sortie', montant: 40, banque: 'bb', date: '2026-10-06T00:00:00.000Z', ...reimbursed },
    { id: 'c', type: 'Entrée', montant: 10, banque: 'bb', date: '2026-10-07T00:00:00.000Z' },
  ]

  assert.equal(accountBalancesAt(accounts, transactions, initialBalances).bb, 910)
  assert.equal(accountPeriodAmounts(accounts, transactions).bb, -90)

  const last = accountTimeline(accounts, transactions, initialBalances).at(-1)
  assert.equal(last.bb, 910)
})

test('a reimbursed expense is left out of Charges and Plaisirs', () => {
  const categories = [
    { id: 'charges', nom: 'Charges 💸', roleId: 'charges' },
    { id: 'fun', nom: 'Plaisir 🥳', roleId: 'fun' },
    { id: 'salary', nom: 'Salaire 💶', roleId: 'salary' },
  ]
  const transactions = [
    { type: 'Entrée', montant: 1000, categoryId: 'salary' },
    { type: 'Sortie', montant: 200, categoryId: 'charges' },
    { type: 'Sortie', montant: 50, categoryId: 'charges', ...reimbursed },
    { type: 'Sortie', montant: 30, categoryId: 'fun', ...reimbursed },
    { type: 'Sortie', montant: 20, categoryId: 'fun' },
  ]
  const summary = financeSummary(transactions, categories)
  assert.equal(summary.charges, 200)
  assert.equal(summary.fun, 20)
  assert.equal(summary.income, 1000)
})

const base = () => ({
  accounts: [{ id: 'a1', name: 'Courant', color: '#123456' }],
  initialBalances: [],
  categories: [
    { id: 'c1', nom: 'Charges 💸', roleId: 'charges', defaultRole: true },
    { id: 'c2', nom: 'Salaire 💶', roleId: 'salary', defaultRole: true },
  ],
  transactions: [
    {
      id: 't1', type: 'Sortie', montant: 42, banque: 'a1', categoryId: 'c1',
      categorie: 'Charges 💸', description: 'Restaurant', date: '2026-10-05T00:00:00.000Z',
      ...reimbursed,
    },
    {
      id: 't2', type: 'Sortie', montant: 12, banque: 'a1', categoryId: 'c1',
      categorie: 'Charges 💸', description: 'Café', date: '2026-10-06T00:00:00.000Z',
    },
  ],
  recurringRules: [],
})

const roundTrip = async data => {
  const file = createExportV21(data)
  return parseExportV21(await file.arrayBuffer(), file.name)
}

// Rewrites the Transactions sheet of an export, to simulate edited or older files.
async function editTransactionsSheet(data, edit) {
  const file = createExportV21(data)
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const rows = XLSX.utils.sheet_to_json(book.Sheets.Transactions, { header: 1, defval: '' })
  book.Sheets.Transactions = XLSX.utils.aoa_to_sheet(edit(rows))
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' })
}

test('export then import restores the reimbursement date and person exactly', async () => {
  const original = base()
  assert.deepEqual(await roundTrip(original), original)

  const file = createExportV21(original)
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const [header, first, second] = XLSX.utils.sheet_to_json(book.Sheets.Transactions, { header: 1, defval: '' })
  assert.deepEqual(header.slice(-3), ['RemboursementDate', 'RemboursementPar', 'RemboursementMontant'])
  assert.deepEqual(first.slice(-3), ['2026-11-05', 'Pierre', ''])
  assert.deepEqual(second.slice(-3), ['', '', ''])
})

test('older V2.1 exports (2.1.2 with 11 columns, 2.1.3 with 13) are still accepted', async () => {
  const original = base()
  const legacy = await editTransactionsSheet(original, rows => rows.map(row => row.slice(0, 11)))
  const parsed = parseExportV21(legacy, 'ancien.xlsx')
  assert.equal(parsed.transactions.length, 2)
  assert.ok(parsed.transactions.every(t => !('reimbursedAt' in t) && !('reimbursedBy' in t)))

  const version213 = await editTransactionsSheet(original, rows => rows.map(row => row.slice(0, 13)))
  assert.deepEqual(parseExportV21(version213, 'v2-1-3.xlsx'), original)
})

test('import rejects half-filled, invalid or misplaced reimbursement data and partial column sets', async () => {
  const original = base()
  const withRow = (index, patch) => editTransactionsSheet(original, rows =>
    rows.map((row, i) => (i === index ? Object.assign([...row], patch) : row)))

  await assert.rejects(
    async () => parseExportV21(await withRow(1, { 11: '', 12: 'Pierre' }), 'x.xlsx'),
    /ensemble/
  )
  await assert.rejects(
    async () => parseExportV21(await withRow(2, { 11: '2026-11-05', 12: '' }), 'x.xlsx'),
    /ensemble/
  )
  await assert.rejects(
    async () => parseExportV21(await withRow(1, { 11: '2026-13-40', 12: 'Pierre' }), 'x.xlsx'),
    /RemboursementDate/
  )

  const incomeData = base()
  incomeData.transactions = [{
    id: 't3', type: 'Entrée', montant: 5, banque: 'a1', categoryId: 'c2',
    categorie: 'Salaire 💶', description: '', date: '2026-10-06T00:00:00.000Z',
  }]
  const incomeFile = await editTransactionsSheet(incomeData, rows =>
    rows.map((row, i) => (i === 1 ? Object.assign([...row], { 11: '2026-11-05', 12: 'Pierre' }) : row)))
  assert.throws(() => parseExportV21(incomeFile, 'x.xlsx'), /Seule une Sortie/)

  const oneExtraColumn = await editTransactionsSheet(original, rows => rows.map(row => row.slice(0, 12)))
  assert.throws(() => parseExportV21(oneExtraColumn, 'x.xlsx'), /Colonnes invalides/)
})

test('importing a different reimbursement for an existing transaction is a blocking conflict', async () => {
  const original = base()
  const parsed = await roundTrip(original)
  const existing = structuredClone(original)

  // Same data: nothing to do.
  assert.equal(planImportV21(parsed, existing).totalSkipped > 0, true)

  existing.transactions[0].reimbursedBy = 'Mutuelle'
  assert.throws(() => planImportV21(parsed, existing), /t1/)

  // A reimbursement present on one side only is also a difference.
  delete existing.transactions[0].reimbursedAt
  delete existing.transactions[0].reimbursedBy
  assert.throws(() => planImportV21(parsed, existing), /t1/)
})

const partial = { ...reimbursed, reimbursedAmount: 30 }

test('a partial reimbursement leaves only the unreimbursed part to count', () => {
  const expense = { type: 'Sortie', montant: 50 }
  assert.equal(effectiveAmount({ ...expense, ...reimbursed }), 0)
  assert.equal(refundedAmount({ ...expense, ...reimbursed }), 50)
  assert.equal(isPartiallyReimbursed({ ...expense, ...reimbursed }), false)

  assert.equal(effectiveAmount({ ...expense, ...partial }), 20)
  assert.equal(refundedAmount({ ...expense, ...partial }), 30)
  assert.equal(isPartiallyReimbursed({ ...expense, ...partial }), true)

  // Cents stay exact, and an amount above the expense (edited later) never goes negative.
  assert.equal(effectiveAmount({ ...expense, ...reimbursed, reimbursedAmount: 0.1 + 0.2 }), 49.7)
  assert.equal(effectiveAmount({ ...expense, ...reimbursed, reimbursedAmount: 80 }), 0)
  // The amount is ignored when the expense is not reimbursed.
  assert.equal(effectiveAmount({ ...expense, reimbursedAmount: 30 }), 50)
})

test('the refunded amount is validated against the expense and normalised', () => {
  const input = extra => ({ ...reimbursed, ...extra })
  assert.deepEqual(reimbursementFields('Sortie', input({ reimbursedAmount: '' }), 50), reimbursed)
  assert.deepEqual(reimbursementFields('Sortie', input({ reimbursedAmount: '30' }), 50), partial)
  assert.deepEqual(reimbursementFields('Sortie', input({ reimbursedAmount: '20 + 10,00' }), 50), partial)
  assert.deepEqual(reimbursementFields('Sortie', input({ reimbursedAmount: 30 }), 50), partial)
  // Equal to the expense = fully reimbursed: nothing extra is stored.
  assert.deepEqual(reimbursementFields('Sortie', input({ reimbursedAmount: '50' }), 50), reimbursed)
  assert.throws(() => reimbursementFields('Sortie', input({ reimbursedAmount: '50,01' }), 50), /dépasser/)
  assert.throws(() => reimbursementFields('Sortie', input({ reimbursedAmount: '0' }), 50), /supérieur à zéro/)
  assert.throws(() => reimbursementFields('Sortie', input({ reimbursedAmount: '-5' }), 50))
  assert.throws(() => reimbursementFields('Sortie', input({ reimbursedAmount: 'abc' }), 50))
  assert.throws(() => reimbursementFields('Sortie', input({ reimbursedAmount: '10' }), undefined), /montant de la dépense/)
  // An amount alone is still incomplete: date and person are required.
  assert.throws(() => reimbursementFields('Sortie', { reimbursedAmount: '10' }, 50), /date/)
  assert.throws(() => reimbursementFields('Entrée', input({ reimbursedAmount: '10' }), 50), /Sortie/)
})

test('a partial reimbursement lowers balances and Charges only by the refunded part', () => {
  const accounts = [{ id: 'bb' }]
  const initialBalances = [{
    id: 'start', accountId: 'bb', label: 'Départ', amount: 1000, date: '2026-10-01T00:00:00.000Z',
  }]
  // 100 spent, 30 reimbursed: 70 stays.
  const expense = { id: 'a', type: 'Sortie', montant: 100, banque: 'bb', date: '2026-10-05T00:00:00.000Z', ...partial }
  assert.equal(accountBalancesAt(accounts, [expense], initialBalances).bb, 930)
  assert.equal(accountPeriodAmounts(accounts, [expense]).bb, -70)

  const categories = [{ id: 'charges', nom: 'Charges 💸', roleId: 'charges' }]
  const summary = financeSummary([
    { type: 'Sortie', montant: 100, categoryId: 'charges', ...partial },
    { type: 'Sortie', montant: 40, categoryId: 'charges' },
  ], categories)
  assert.equal(summary.charges, 110)
})

test('export then import restores a partial reimbursement amount', async () => {
  const original = base()
  original.transactions[0].reimbursedAmount = 30
  assert.deepEqual(await roundTrip(original), original)

  const file = createExportV21(original)
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const [, first, second] = XLSX.utils.sheet_to_json(book.Sheets.Transactions, { header: 1, defval: '' })
  assert.deepEqual(first.slice(-3), ['2026-11-05', 'Pierre', 30])
  assert.deepEqual(second.slice(-3), ['', '', ''])
})

test('import validates the refunded amount column', async () => {
  const original = base()
  const withRow = (index, patch) => editTransactionsSheet(original, rows =>
    rows.map((row, i) => (i === index ? Object.assign([...row], patch) : row)))

  // Equal to the expense: accepted and normalised to a full reimbursement.
  const full = parseExportV21(await withRow(1, { 13: 42 }), 'x.xlsx')
  assert.equal('reimbursedAmount' in full.transactions[0], false)
  assert.equal(full.transactions[0].reimbursedAt, '2026-11-05')

  // Decimal comma text, as typed in a spreadsheet.
  const typed = parseExportV21(await withRow(1, { 13: '12,50' }), 'x.xlsx')
  assert.equal(typed.transactions[0].reimbursedAmount, 12.5)

  await assert.rejects(async () => parseExportV21(await withRow(1, { 13: 42.01 }), 'x.xlsx'), /dépasse/)
  await assert.rejects(async () => parseExportV21(await withRow(1, { 13: 0.5, 11: '', 12: '' }), 'x.xlsx'), /exige/)
  await assert.rejects(async () => parseExportV21(await withRow(1, { 13: 'beaucoup' }), 'x.xlsx'), /RemboursementMontant/)
  await assert.rejects(async () => parseExportV21(await withRow(1, { 13: -3 }), 'x.xlsx'), /RemboursementMontant/)
  // An amount on a transaction that is not reimbursed at all is incomplete.
  await assert.rejects(async () => parseExportV21(await withRow(2, { 13: 5 }), 'x.xlsx'), /exige/)
})

test('a different refunded amount on an existing transaction is a blocking conflict', async () => {
  const original = base()
  original.transactions[0].reimbursedAmount = 30
  const parsed = await roundTrip(original)
  const existing = structuredClone(original)
  assert.equal(planImportV21(parsed, existing).totalSkipped > 0, true)

  existing.transactions[0].reimbursedAmount = 20
  assert.throws(() => planImportV21(parsed, existing), /t1/)
  delete existing.transactions[0].reimbursedAmount
  assert.throws(() => planImportV21(parsed, existing), /t1/)
})
