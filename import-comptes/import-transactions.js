const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');
const XLSX = require('xlsx');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT = require('./serviceAccount.json');
initializeApp({ credential: cert(SERVICE_ACCOUNT) });
const db = getFirestore();

// ── DEMANDER LA PASSPHRASE ──────────────────────────────────────────────────
async function askPassphrase() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question('🔐 Entre ta passphrase : ', (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

// ── DEMANDER LE FICHIER ─────────────────────────────────────────────────────
async function askFile() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question('📁 Nom du fichier à importer (ex: Comptes_-_Historique.csv ou mes-comptes.xlsx) : ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// ── RÉCUPÉRER LE SALT ───────────────────────────────────────────────────────
async function getSalt() {
  const doc = await db.collection('config').doc('crypto').get()
  if (!doc.exists) throw new Error('Config crypto introuvable — as-tu fait le setup ?')
  return doc.data().saltHex
}

// ── DÉRIVER LA CLÉ ──────────────────────────────────────────────────────────
async function deriveKey(passphrase, saltHex) {
  const salt = Buffer.from(saltHex, 'hex')
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(passphrase, salt, 310000, 32, 'sha256', (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

// ── CHIFFRER ────────────────────────────────────────────────────────────────
function encryptData(data, keyBuffer) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv)
  const json = JSON.stringify(data)
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const combined = Buffer.concat([encrypted, authTag])
  return {
    iv: iv.toString('base64'),
    data: combined.toString('base64')
  }
}

// ── CATÉGORISATION ──────────────────────────────────────────────────────────
function getCategorie(description, type) {
  const d = (description || '').toLowerCase().trim()

  const epargne = ['économi', 'economie', 'investissement', 'actions', 'banxo vers tr']
  if (epargne.some(k => d.includes(k))) return 'Épargne'

  if (type === 'Entrée') {
    if (d === 'knds' || d.includes('salaire knds')) return 'Salaire'
    if (d.includes('caf')) return 'Salaire'
    if (['ce départ','sumeria départ','reste porte monnaie','livret dd',
         'cmb livret a','cmb livret jeune','tr','inscription boursorama'].includes(d)) return 'Salaire'
    if (d.includes('remboursement')) return 'Plaisir'
    if (d.includes('covoiturage')) return 'Plaisir'
    if (d.includes('cadeau') || d.includes('payement')) return 'Salaire'
    return 'Salaire'
  }

  const charges = [
    'assurance', 'cotisation', 'carte liberté', 'carte sim', 'forfait',
    'youtube', 'youprice', 'clash royal', 'claud', 'médecin', 'medecin',
    'réparation', 'roulement', 'bluetooth yaris', 'pressing', 'cantine',
    'self knds', 'compte commun', 'phares', 'bouillote', 'subway surfer city', 'minecraft'
  ]
  if (charges.some(k => d.includes(k))) return 'Charges'
  if (d.includes('essence') || d.includes('péage') || d.includes('peage')) return 'Charges'

  return 'Plaisir'
}

// ── PARSER CSV (format Google Sheet) ────────────────────────────────────────
function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
  const transactions = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue }
      current += ch
    }
    cols.push(current.trim())

    const type = cols[0]
    const montant = parseFloat(cols[1])
    const banque = cols[2]
    const description = cols[3]
    const dateStr = cols[4]

    if (!type || (type !== 'Entrée' && type !== 'Sortie')) continue
    if (!montant && montant !== 0) continue
    if (!banque || !['BB','CMB','TR'].includes(banque)) continue
    if (!dateStr) continue

    const [day, month, year] = dateStr.split('/')
    const date = new Date(`${year}-${month}-${day}`)
    if (isNaN(date)) continue

    transactions.push({
      type,
      montant,
      banque,
      description: description.replace(/\s+/g, ' ').trim(),
      date: date.toISOString(),
      categorie: getCategorie(description, type)
    })
  }

  return transactions
}

// ── PARSER XLSX (format export application) ──────────────────────────────────
function parseXLSX(filePath) {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet)
  const transactions = []

  for (const row of rows) {
    const type = row['Type']
    const montant = parseFloat(row['Montant'])
    const banque = row['Banque']
    const categorie = row['Catégorie'] || getCategorie(row['Description'], type)
    const description = (row['Description'] || '').trim()
    const dateStr = row['Date']

    if (!type || (type !== 'Entrée' && type !== 'Sortie')) continue
    if (!montant && montant !== 0) continue
    if (!banque || !['BB','CMB','TR'].includes(banque)) continue
    if (!dateStr) continue

    // Parser la date au format DD/MM/YYYY
    let date
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/')
      date = new Date(`${year}-${month}-${day}`)
    } else if (typeof dateStr === 'number') {
      // Format Excel numérique
      date = new Date((dateStr - 25569) * 86400 * 1000)
    } else {
      date = new Date(dateStr)
    }

    if (isNaN(date)) continue

    transactions.push({
      type,
      montant,
      banque,
      description,
      date: date.toISOString(),
      categorie
    })
  }

  return transactions
}

// ── IMPORT CHIFFRÉ ──────────────────────────────────────────────────────────
async function importTransactions() {
  const fileName = await askFile()

  if (!fs.existsSync(`./${fileName}`)) {
    console.error(`❌ Fichier introuvable : ${fileName}`)
    process.exit(1)
  }

  const ext = fileName.split('.').pop().toLowerCase()
  let transactions = []

  if (ext === 'csv') {
    console.log('📄 Format détecté : CSV (Google Sheet)')
    transactions = parseCSV(`./${fileName}`)
  } else if (ext === 'xlsx' || ext === 'xls') {
    console.log('📊 Format détecté : Excel (export application)')
    transactions = parseXLSX(`./${fileName}`)
  } else {
    console.error('❌ Format non supporté. Utilise un fichier .csv ou .xlsx')
    process.exit(1)
  }

  const passphrase = await askPassphrase()
  console.log('🔑 Récupération du salt depuis Firestore...')
  const saltHex = await getSalt()
  console.log('⚙️  Dérivation de la clé...')
  const keyBuffer = await deriveKey(passphrase, saltHex)
  console.log('✅ Clé dérivée !')

  console.log(`📊 ${transactions.length} transactions à importer...`)
  const stats = {}
  transactions.forEach(t => {
    stats[t.categorie] = (stats[t.categorie] || 0) + 1
  })
  console.log('📁 Répartition :', stats)

  // Import par batch de 500
  const batchSize = 500
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = db.batch()
    const chunk = transactions.slice(i, i + batchSize)
    chunk.forEach(t => {
      const encrypted = encryptData(t, keyBuffer)
      const ref = db.collection('transactions').doc()
      batch.set(ref, encrypted)
    })
    await batch.commit()
    console.log(`✅ Batch ${Math.floor(i/batchSize)+1} importé (${chunk.length} transactions)`)
  }

  // Catégories chiffrées
  const categories = ['Salaire', 'Plaisir', 'Charges', 'Épargne']
  for (const nom of categories) {
    const snap = await db.collection('categories').where('nom', '==', nom).get()
    if (snap.empty) {
      const encrypted = encryptData({ nom }, keyBuffer)
      await db.collection('categories').add(encrypted)
      console.log(`✅ Catégorie ajoutée : ${nom}`)
    }
  }

  console.log('🎉 Import chiffré terminé !')
}

importTransactions().catch(console.error)