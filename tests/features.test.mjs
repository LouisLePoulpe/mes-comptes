import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateAmount } from '../src/domain/amount.js'
import { matchesDescription } from '../src/domain/search.js'
import { shareExport, canShareExport } from '../src/transfer/export.js'


test('amount expressions respect precedence, French decimals and exact cent rounding', () => {
  for (const [input, output] of [['(12,50 + 7,50) / 2',10],['2+3*4',14],['1.005',1.01],['0.1+0.2',0.3],['10/3',3.33],['3×(7−2)',15],['.5 + .5',1],['10--2',12]]) assert.equal(calculateAmount(input), output)
  for (const input of ['', '1/0','1/(-0)','-2','0.001','1+','(2+1','2abc','Math.random()','2**3','1;alert(1)','9'.repeat(200)]) assert.throws(() => calculateAmount(input))
})
test('history search ignores case, accents and extra spaces, combining words', () => {
  assert.ok(matchesDescription({description:'CAFÉ du Marché'}, '  marche CAFE '))
  assert.ok(!matchesDescription({description:'Salaire'}, 'courses'))
  assert.ok(matchesDescription({}, ''))
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
