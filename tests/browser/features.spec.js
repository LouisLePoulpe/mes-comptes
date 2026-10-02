import { test, expect } from '@playwright/test'
import * as XLSX from 'xlsx'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { login, setup, navigate } from './helpers'

const records = [
  { Type:'Entrée', Montant:100, Banque:'BB', Catégorie:'Salaire', Description:'Premier salaire', Date:'15/01/2001' },
  { Type:'Sortie', Montant:12.5, Banque:'CMB', Catégorie:'Courses', Description:'Café du marché', Date:'15/06/2025' },
  { Type:'Sortie', Montant:12.5, Banque:'CMB', Catégorie:'Courses', Description:'Café du marché', Date:'15/06/2025' },
]
function file(rows) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Transactions')
  return { name:'historique-v1.xlsx', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer:Buffer.from(XLSX.write(book,{bookType:'xlsx',type:'array'})) }
}
async function chooseImport(page, rows) {
  await navigate(page,'Historique')
  await page.getByRole('button',{name:'Importer un historique',exact:true}).click()
  await page.getByLabel('Fichier à importer').setInputFiles(file(rows))
}

test('import V1 confirmé, doublons, recherche, calculs, thème et export intégral',async ({page},info)=>{
  await page.goto('./')
  await login(page,`features-${info.project.name}@example.test`)
  await setup(page)
  await navigate(page, 'Paramètres')
  await expect(page.getByText(`features-${info.project.name}@example.test`, { exact: true })).toBeVisible()
  await page.getByRole('button',{name:'Activer le mode clair'}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(248, 250, 252)')
  await chooseImport(page,[...records,{...records[0],Date:'31/02/2025'}])
  await expect(page.getByRole('alert')).toContainText('aucune ligne n’a été ajoutée')
  await expect(page.getByRole('button',{name:'Confirmer l’import'})).toBeHidden()
  await page.getByLabel('Fichier à importer').setInputFiles(file(records))
  await page.getByRole('button',{name:'Préparer l’aperçu'}).click()
  await expect(page.getByText('3 à ajouter · 0 déjà présentes')).toBeVisible()
  await page.getByRole('button', { name: 'Vérifier la cohérence avec cet export' }).click()
  await expect(page.getByRole('region', { name: 'Comparaison de l’historique' })).toContainText('3 ligne(s) manquante(s)')
  await page.getByRole('button',{name:'Retour',exact:true}).click()
  await expect(page.getByText('Aucune transaction',{exact:true})).toBeVisible()
  await chooseImport(page,records)
  await page.getByRole('button',{name:'Préparer l’aperçu'}).click()
  await page.getByRole('button',{name:'Confirmer l’import'}).click()
  await expect(page.getByRole('status')).toHaveText('Import terminé : 3 ajoutées, 0 déjà présentes.')
  await page.getByRole('button', { name: 'Vérifier la cohérence avec cet export' }).click()
  await expect(page.getByRole('region', { name: 'Comparaison de l’historique' })).toContainText('Historique identique à cet export.')
  await page.getByRole('button',{name:'Retour',exact:true}).click()
  await expect(page.getByText('3 transactions',{exact:true})).toBeVisible()
  await page.getByLabel('Rechercher par nom').fill('CAFE marche')
  await expect(page.getByText('2 transactions',{exact:true})).toBeVisible()
  await expect(page.getByText('Premier salaire',{exact:true})).toBeHidden()
  // Export ignores display filters and includes all dates.
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button',{name:'Export Excel',exact:true}).click()
  const download = await downloaded
  const book = XLSX.read(await readFile(await download.path()))
  const rows = XLSX.utils.sheet_to_json(book.Sheets.Transactions)
  expect(rows).toHaveLength(3)
  expect(rows[0].Date).toBe('15/01/2001')
  await page.getByLabel('Rechercher par nom').fill('salaire')
  await page.getByRole('button',{name:'Modifier Premier salaire'}).click()
  await page.getByLabel('Montant (€)').fill('(100 + 7,50) / 2')
  await expect(page.getByText('Résultat : 53,75 €')).toBeVisible()
  await page.getByRole('button',{name:'Sauvegarder'}).click()
  await expect(page.getByText('+53.75€',{exact:true})).toBeVisible()
  await chooseImport(page,records)
  await page.getByRole('button',{name:'Préparer l’aperçu'}).click()
  await expect(page.getByText('0 à ajouter · 3 déjà présentes')).toBeVisible()
  await expect(page.getByRole('button',{name:'Confirmer l’import'})).toBeDisabled()
  await navigate(page,'Ajouter')
  await page.getByLabel('Montant (€)').fill('1 / 0')
  await page.getByRole('button',{name:/Enregistrer/}).click()
  await expect(page.getByRole('alert')).toHaveText('La division par zéro est impossible.')
  await page.getByLabel('Montant (€)').fill('12,50 + 2 * 3')
  await page.getByLabel('Catégorie',{exact:true}).selectOption({label:'Courses'})
  await page.getByLabel('Description',{exact:true}).fill('Achat calculé')
  await page.getByRole('button',{name:/Enregistrer/}).click()
  await expect(page.getByText('-18.5€',{exact:true})).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading',{name:'Dashboard'})).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  await page.getByRole('combobox').selectOption('all')
  await page.screenshot({path:info.outputPath('mode-clair.png'),fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByRole('button',{name:'Activer le mode sombre'}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
})

test('partage mobile : fichier Excel, annulation et solution de téléchargement',async ({page},info)=>{
  await page.addInitScript(()=>{
    window.testShareMode='success'
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true})
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
      window.testSharedFile={name:data.files[0].name,type:data.files[0].type,size:data.files[0].size}
      if(window.testShareMode==='cancel') throw new DOMException('cancel','AbortError')
      if(window.testShareMode==='error') throw new Error('unavailable')
    }})
  })
  await page.goto('./')
  await login(page,`sharing-${info.project.name}@example.test`)
  await setup(page)
  await navigate(page,'Historique')
  await page.getByRole('button',{name:'Partager l’export'}).click()
  await expect(page.getByRole('status')).toHaveText('Partage terminé.')
  const shared=await page.evaluate(()=>window.testSharedFile)
  expect(shared.name).toBe('mes-comptes.xlsx'); expect(shared.size).toBeGreaterThan(0)
  await page.evaluate(()=>{window.testShareMode='cancel'})
  await page.getByRole('button',{name:'Partager l’export'}).click()
  await expect(page.getByRole('status')).toContainText('Partage annulé')
  await page.evaluate(()=>{window.testShareMode='error'})
  await page.getByRole('button',{name:'Partager l’export'}).click()
  await expect(page.getByRole('status')).toContainText('Partage impossible')
  const downloading=page.waitForEvent('download')
  await page.getByRole('button',{name:'Export Excel',exact:true}).click()
  expect((await downloading).suggestedFilename()).toBe('mes-comptes.xlsx')
})

test('un import interrompu après 100 lignes reprend sans perte ni doublon', async ({ page }, info) => {
  await page.goto('./')
  await login(page, `batch-${info.project.name}@example.test`)
  await setup(page)
  const imported = Array.from({length:205},(_,index)=>({...records[0],Description:`Historique ${index}`,Montant:1}))
  const count = await page.evaluate(async rows => {
    const { auth } = await import('/mes-comptes/src/firebase.js')
    const { loadKeyLocally } = await import('/mes-comptes/src/crypto.js')
    const { planImport } = await import('/mes-comptes/src/transfer/plan.js')
    const { commitImport } = await import('/mes-comptes/src/transfer/import.js')
    const uid = auth.currentUser.uid
    const {key} = await loadKeyLocally(uid)
    const source = rows.map(row=>({type:row.Type,montant:row.Montant,banque:row.Banque,categorie:row.Catégorie,description:row.Description,date:'2001-01-15T00:00:00.000Z'}))
    const plan = await planImport(source,{BB:'__new__'},[],[],[])
    let progress = 0
    try { await commitImport(uid,key,plan,current=>{progress=current;throw new Error('simulated interruption')}) }
    catch(error) { if(error.message!=='simulated interruption') throw error }
    return progress
  }, imported)
  expect(count).toBe(100)
  await navigate(page,'Historique')
  await expect(page.getByText('100 transactions',{exact:true})).toBeVisible()
  await chooseImport(page,imported)
  await page.getByRole('button',{name:'Préparer l’aperçu'}).click()
  await expect(page.getByText('105 à ajouter · 100 déjà présentes')).toBeVisible()
  await page.getByRole('button',{name:'Confirmer l’import'}).click()
  await expect(page.getByRole('status')).toHaveText('Import terminé : 105 ajoutées, 100 déjà présentes.')
  await page.getByRole('button',{name:'Retour',exact:true}).click()
  await expect(page.getByText('205 transactions',{exact:true})).toBeVisible()
})
