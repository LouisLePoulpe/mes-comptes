import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { calculateAmount } from '../src/domain/amount.js'
import { matchesDescription } from '../src/domain/search.js'
import { parseExport } from '../src/transfer/parse.js'
import { planImport } from '../src/transfer/plan.js'
import { createExport, shareExport, canShareExport } from '../src/transfer/export.js'

function excel(rows) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Transactions')
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' })
}
const row = { Type: 'Entrée', Montant: '12,50', Banque: 'BB', Catégorie: 'Salaire', Description: 'Ancienne opération', Date: '15/01/2001' }

test('amount expressions respect precedence, French decimals and exact cent rounding', () => {
  for (const [input, output] of [['(12,50 + 7,50) / 2',10],['2+3*4',14],['1.005',1.01],['0.1+0.2',0.3],['10/3',3.33],['3×(7−2)',15],['.5 + .5',1],['10--2',12]]) assert.equal(calculateAmount(input), output)
  for (const input of ['', '1/0','1/(-0)','-2','0.001','1+','(2+1','2abc','Math.random()','2**3','1;alert(1)','9'.repeat(200)]) assert.throws(() => calculateAmount(input))
})
test('history search ignores case, accents and extra spaces, combining words', () => {
  assert.ok(matchesDescription({description:'CAFÉ du Marché'}, '  marche CAFE '))
  assert.ok(!matchesDescription({description:'Salaire'}, 'courses'))
  assert.ok(matchesDescription({}, ''))
})
test('legacy Excel/CSV imports validate all rows and dates without truncating history', () => {
  const parsed = parseExport(excel([row, {...row, Date:'2025-06-15', Montant:0}]), 'v1.xlsx')
  assert.equal(parsed.errors.length, 0)
  assert.equal(parsed.records[0].date, '2001-01-15T00:00:00.000Z')
  assert.equal(parsed.records[0].montant, 12.5)
  assert.equal(parsed.records[1].montant, 0)
  const bad = parseExport(excel([row, {...row, Date:'31/02/2025'}, {...row, Montant:'12oops'}]), 'bad.xlsx')
  assert.equal(bad.errors.length, 2)
  const csv = new TextEncoder().encode('Type;Montant;Banque;Description;Date\nSortie;"12,50";CMB;"Courses; café";15/01/2001')
  const records = parseExport(csv, 'legacy.csv').records
  assert.equal(records[0].description, 'Courses; café')
  assert.equal(records[0].categorie, 'Non classé')
  assert.throws(() => parseExport(excel([{ X: 1 }]), 'bad.xlsx'), /Colonne/)
})
test('import maps accounts, preserves repeated legitimate rows and skips repeats or edited import IDs', async () => {
  const records = parseExport(excel([row, row]), 'v1.xlsx').records
  const accounts = [{ id:'custom',name:'Courant' }]
  const plan = await planImport(records, {BB:'custom'}, [], accounts, [])
  assert.equal(plan.transactions.length, 2)
  assert.equal(plan.accounts.length, 0)
  const existing = plan.transactions.map(t => ({...t.data,id:t.id}))
  const retry = await planImport(records, {BB:'custom'}, existing, accounts, [])
  assert.equal(retry.transactions.length, 0)
  assert.equal(retry.skipped, 2)
  existing[0].montant = 999
  const edited = await planImport(records, {BB:'custom'}, existing, accounts, [])
  assert.equal(edited.transactions.length, 0)
  const missing = await planImport(records, {BB:'custom'}, [existing[1]], accounts, [])
  assert.equal(missing.transactions.length, 1) // restore the missing first occurrence, keep the second
  await assert.rejects(planImport(records, {BB:'missing'}, [], accounts, []))
})
test('export/import round trip retains complete dates, amounts and text as text (no formulas)', async () => {
  const rows = parseExport(excel([row]), 'v1.xlsx').records
  rows[0].description = '=HYPERLINK("example.test")'
  const file = createExport(rows, () => 'Courant')
  const parsed = parseExport(await file.arrayBuffer(), file.name)
  assert.deepEqual(parsed.records, [{...rows[0],banque:'Courant'}])
})
test('file sharing preserves cancellation and reports unavailable capability', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{canShare:()=>true,share:async()=>{throw new DOMException('cancelled','AbortError')}}})
  try {
    assert.ok(canShareExport(new File(['a'],'test.xlsx')))
    assert.equal(await shareExport(new File(['a'],'test.xlsx')), 'cancelled')
    navigator.canShare = () => false
    assert.equal(canShareExport(new File(['a'],'test.xlsx')), false)
    navigator.share = async()=>{throw new Error('denied')}
    await assert.rejects(shareExport(new File(['a'],'test.xlsx')), /denied/)
  } finally { Object.defineProperty(globalThis,'navigator',previous) }
})
