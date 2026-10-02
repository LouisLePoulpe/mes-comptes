import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareHistory } from '../src/transfer/compare.js'

test('migration comparison detects missing duplicates, changed accounts and offsetting amount errors', () => {
  const row = { type: 'Entrée', montant: 10, banque: 'bank', categorie: 'Salaire', description: 'Ancien', date: '2001-01-01' }
  const source = [row, row, { ...row, type: 'Sortie', montant: 3, date: '2026-01-02' }]
  assert.equal(compareHistory(source, structuredClone(source)).identical, true)
  const missing = compareHistory(source, source.slice(1))
  assert.equal(missing.missing, 1)
  assert.equal(missing.extra, 0)
  const changed = compareHistory(source, [{ ...row, montant: 9 }, { ...row, montant: 11 }, source[2]])
  assert.equal(changed.source.income, changed.destination.income)
  assert.equal(changed.identical, false)
  assert.equal(changed.missing, 2)
  assert.equal(compareHistory([row], [{ ...row, banque: 'other' }]).identical, false)
  assert.equal(missing.source.first, '2001-01-01')
  assert.equal(missing.source.last, '2026-01-02')
})
