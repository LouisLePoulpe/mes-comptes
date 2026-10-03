export const normalizeSearch = text => String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').trim()
export function matchesDescription(transaction, search) {
  const words = normalizeSearch(search).split(/\s+/).filter(Boolean)
  const name = normalizeSearch(transaction.description)
  return words.every(word => name.includes(word))
}
