import * as XLSX from 'xlsx'

export const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export function createExport(transactions, accountName) {
  const rows = transactions.map(t => ({
    Type: t.type, Montant: t.montant, Banque: accountName(t.banque), Catégorie: t.categorie,
    Description: t.description || '', Date: new Date(t.date).toLocaleDateString('fr-FR', { timeZone: 'UTC' }),
  }))
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows, { header: ['Type', 'Montant', 'Banque', 'Catégorie', 'Description', 'Date'] })
  XLSX.utils.book_append_sheet(book, sheet, 'Transactions')
  return new File([XLSX.write(book, { bookType: 'xlsx', type: 'array' })], 'mes-comptes.xlsx', { type: EXCEL_TYPE })
}
export function downloadExport(file) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url; link.download = file.name
  document.body.appendChild(link); link.click(); link.remove()
  // Keep the URL alive long enough for Android Chrome's download service to open it.
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
export function canShareExport(file) {
  try { return !!navigator.share && !!navigator.canShare?.({ files: [file] }) }
  catch { return false }
}
export async function shareExport(file) {
  try { await navigator.share({ files: [file], title: 'Mes Comptes' }); return 'shared' }
  catch (error) { if (error.name === 'AbortError') return 'cancelled'; throw error }
}
