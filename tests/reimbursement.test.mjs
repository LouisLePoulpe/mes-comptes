import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'

import {
  effectiveAmount,
  isReimbursed,
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
  assert.deepEqual(header.slice(-2), ['RemboursementDate', 'RemboursementPar'])
  assert.deepEqual(first.slice(-2), ['2026-11-05', 'Pierre'])
  assert.deepEqual(second.slice(-2), ['', ''])
})

test('an older V2.1 export without the reimbursement columns is still accepted', async () => {
  const original = base()
  const legacy = await editTransactionsSheet(original, rows => rows.map(row => row.slice(0, 11)))
  const parsed = parseExportV21(legacy, 'ancien.xlsx')
  assert.equal(parsed.transactions.length, 2)
  assert.ok(parsed.transactions.every(t => !('reimbursedAt' in t) && !('reimbursedBy' in t)))
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
