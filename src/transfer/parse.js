import * as XLSX from 'xlsx'

const normalized = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()
export function importDate(value, date1904 = false) {
  let year, month, day
  if (typeof value === 'number') {
    const parts = XLSX.SSF.parse_date_code(value, { date1904 })
    if (!parts) throw new Error('Date Excel invalide')
    ;({ y: year, m: month, d: day } = parts)
  } else {
    const text = String(value ?? '').trim()
    const french = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(text)
    if (french) [, day, month, year] = french.map(Number)
    else if (iso) [, year, month, day] = iso.map(Number)
    else throw new Error('Date attendue au format JJ/MM/AAAA')
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (year < 1900 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Date invalide')
  return date.toISOString()
}
export function parseExport(buffer, filename) {
  if (!/\.(xlsx|csv)$/i.test(filename)) throw new Error('Choisis un export .xlsx ou .csv.')
  if (buffer.byteLength > 10 * 1024 * 1024) throw new Error('Le fichier dépasse 10 Mo. Divise-le en plusieurs exports.')
  let input = buffer
  const csv = /\.csv$/i.test(filename)
  if (csv) {
    try { input = new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
    catch { input = new TextDecoder('windows-1252').decode(buffer) }
  }
  const workbook = XLSX.read(input, { type: csv ? 'string' : 'array', raw: true, cellDates: false, cellFormula: true })
  const name = workbook.SheetNames.includes('Transactions') ? 'Transactions' : workbook.SheetNames[0]
  const sheet = workbook.Sheets[name]
  if (!sheet?.['!ref']) throw new Error('Le fichier ne contient aucune transaction.')
  const range = XLSX.utils.decode_range(sheet['!ref'])
  if (range.e.r > 50000 || range.e.c > 50) throw new Error('Le fichier dépasse 50 000 lignes ou 50 colonnes. Aucun import effectué.')
  if (Object.values(sheet).some(cell => cell && typeof cell === 'object' && cell.f)) throw new Error('Les cellules de formule ne sont pas acceptées : exporte leurs valeurs.')
  const table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: true })
  const headers = table[0].map(normalized)
  for (const key of ['type', 'montant', 'banque', 'description', 'date']) {
    if (headers.filter(header => header === key).length !== 1) throw new Error(`Colonne manquante ou répétée : ${key}`)
  }
  const records = [], errors = []
  table.slice(1).forEach((row, index) => {
    if (row.every(value => value === '')) return
    const field = key => row[headers.indexOf(key)] ?? ''
    try {
      const type = normalized(field('type')) === 'entree' ? 'Entrée' : normalized(field('type')) === 'sortie' ? 'Sortie' : null
      if (!type) throw new Error('Type attendu : Entrée ou Sortie')
      const amountText = String(field('montant')).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
      if (!/^\d+(?:\.\d{1,2})?$/.test(amountText)) throw new Error('Montant positif avec deux décimales maximum attendu')
      const montant = Number(amountText)
      if (!Number.isSafeInteger(Math.round(montant * 100))) throw new Error('Montant trop grand')
      const banque = String(field('banque')).trim()
      if (!banque || banque.length > 100) throw new Error('Nom de banque manquant ou trop long')
      const categorie = String(field('categorie') || 'Non classé').trim()
      const description = String(field('description')).trim()
      if (categorie.length > 200 || description.length > 2000) throw new Error('Libellé trop long')
      records.push({ type, montant, banque, categorie: categorie || 'Non classé', description, date: importDate(field('date'), !!workbook.Workbook?.WBProps?.date1904) })
    } catch (error) { errors.push(`Ligne ${index + 2} : ${error.message}`) }
  })
  if (!records.length && !errors.length) throw new Error('Le fichier ne contient aucune transaction.')
  return { records, errors, sheet: name }
}
