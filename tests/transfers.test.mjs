import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { parseExport } from '../src/transfer/parse.js'
import { planImport } from '../src/transfer/plan.js'
import { compareHistory } from '../src/transfer/compare.js'
import { createExport } from '../src/transfer/export.js'
import { accountMovements } from '../src/domain/movements.js'

test('legacy transfers retain both accounts through import, duplicate checks, export and balances', async () => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{Type:'Transfert',Montant:35.5,Banque:'BB',BanqueDest:'CMB',Catégorie:'Épargne',Description:'Virement fictif',Date:'01/01/2001'}]), 'Transactions')
  const parsed = parseExport(XLSX.write(book,{type:'array',bookType:'xlsx'}),'test.xlsx')
  assert.deepEqual(parsed.errors, [])
  const plan = await planImport(parsed.records, {BB:'__new__',CMB:'__new__'}, [], [], [])
  assert.equal(plan.accounts.length,2)
  const row = plan.transactions[0].data
  const movements = accountMovements(row)
  assert.equal(movements[0][1], -35.5)
  assert.equal(movements[1][1], 35.5)
  assert.equal(movements.reduce((sum, [,value])=>sum+value,0),0)
  const file = createExport([row],id=>plan.accounts.find(a=>a.id===id).data.name)
  assert.deepEqual(parseExport(await file.arrayBuffer(),file.name).records, parsed.records)
  const repeated = await planImport(parsed.records,{BB:row.banque,CMB:row.banqueDest},[{...row,id:plan.transactions[0].id}],plan.accounts,[])
  assert.equal(repeated.transactions.length,0)
  assert.equal(compareHistory([row],[{...row,banqueDest:'wrong'}]).identical,false)
  assert.equal(compareHistory([row],[row]).source.income,0)
  assert.equal(compareHistory([row],[row]).source.expenses,0)
  await assert.rejects(planImport(parsed.records,{BB:row.banque,CMB:row.banque},[],plan.accounts,[]),/différents/)
})
