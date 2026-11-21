import test from 'node:test'
import assert from 'node:assert/strict'
import {
  storedDay,
  storedMonth,
  storedYear,
  storedMonthNumber,
  formatStoredDay,
  localDay,
  localMonth,
} from '../src/domain/calendar.js'

// Ces tests sont rejoués sous plusieurs fuseaux (voir package.json) : le résultat ne doit jamais dépendre de TZ.
const FIRST = '2026-11-01T00:00:00.000Z'
const LAST = '2026-10-31T00:00:00.000Z'

test('une opération du 1er novembre reste en novembre, quel que soit le fuseau', () => {
  assert.equal(storedDay(FIRST), '2026-11-01')
  assert.equal(storedMonth(FIRST), '2026-11')
  assert.equal(storedYear(FIRST), 2026)
  assert.equal(storedMonthNumber(FIRST), 11)
  assert.equal(storedMonth(LAST), '2026-10')
})

test('le 1er janvier reste dans la bonne année', () => {
  const day = '2027-01-01T00:00:00.000Z'
  assert.equal(storedYear(day), 2027)
  assert.equal(storedMonthNumber(day), 1)
})

test('formatStoredDay affiche le jour enregistré', () => {
  assert.equal(formatStoredDay(FIRST), '01/11/2026')
  assert.equal(formatStoredDay('2026-12-31T00:00:00.000Z'), '31/12/2026')
  assert.equal(formatStoredDay('2026-03-29'), '29/03/2026')
})

test('formats acceptés : texte ISO, jour simple, horodatage, valeur invalide', () => {
  assert.equal(storedDay('2026-11-01'), '2026-11-01')
  assert.equal(storedDay(Date.UTC(2026, 10, 1)), '2026-11-01')
  assert.equal(storedDay(new Date(Date.UTC(2026, 10, 1))), '2026-11-01')
  assert.equal(storedDay(''), '')
  assert.equal(storedDay(null), '')
  assert.equal(storedDay('pas une date'), '')
  assert.equal(formatStoredDay('pas une date'), '')
  assert.ok(Number.isNaN(storedYear("")))
  assert.ok(Number.isNaN(storedMonthNumber("pas une date")))
})

test('« aujourd\'hui » suit l\'horloge locale de l\'appareil', () => {
  const now = new Date(2026, 10, 20, 22, 58)
  assert.equal(localDay(now), '2026-11-20')
  assert.equal(localMonth(now), '2026-11')
  const newYear = new Date(2026, 11, 31, 23, 59)
  assert.equal(localDay(newYear), '2026-12-31')
})
