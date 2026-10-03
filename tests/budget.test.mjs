import {test} from 'node:test'
import assert from 'node:assert/strict'
import {budgetSummary,categoryGroup} from '../src/domain/budget.js'
import {trend,orderedCards} from '../src/domain/trend.js'
const row=(type,montant,categorie)=>({type,montant,categorie})
test('strict budget thresholds use exact amounts, not rounded percentages',()=>{
 const result=budgetSummary([row('Entrée',1000,'Salaire'),row('Sortie',500,'Charges'),row('Transfert',200,'Épargne'),row('Sortie',300,'Plaisir')],[])
 assert.deepEqual(result.groups.map(g=>g.ok),[false,false,false])
 const green=budgetSummary([row('Entrée',1000,'Salaire'),row('Sortie',499.99,'Charges'),row('Transfert',200.01,'Épargne'),row('Sortie',299.99,'Plaisir')],[])
 assert.deepEqual(green.groups.map(g=>g.ok),[true,true,true])
 assert.equal(budgetSummary([],[]).groups[0].percent,null)
})
test('custom grouping, savings withdrawals and unclassified costs are explicit',()=>{
 const result=budgetSummary([row('Entrée',1000,'Salaire'),row('Sortie',100,'Loyer'),row('Transfert',250,'Épargne 📈'),row('Entrée',50,'Retrait Épargne'),row('Sortie',20,'Cadeau')],[{nom:'Loyer',budgetGroup:'charges'}])
 assert.equal(result.income,1000)
 assert.equal(result.groups[0].value,100)
 assert.equal(result.groups[1].value,200)
 assert.equal(result.unclassified,20)
 assert.equal(categoryGroup({nom:'Épargne',budgetGroup:'none'}),'none')
})
test('trend is based on elapsed days and card order survives account changes',()=>{
 const data=[{timestamp:0,a:0},{timestamp:86400000,a:2},{timestamp:86400000*10,a:20}]
 const result=trend(data,'a')
 assert.ok(Math.abs(result.monthly-60.875)<0.000001)
 assert.equal(result.last,20)
 assert.equal(trend([{timestamp:0,a:1}],'a').last,null)
 assert.deepEqual(orderedCards([{id:'a'},{id:'b'}],['consumption','gone','a','a']),['consumption','a','b'])
})
