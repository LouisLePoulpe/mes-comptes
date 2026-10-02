// Compare occurrences, not just totals: duplicate rows and offsetting errors matter.
const key = row => JSON.stringify([row.type, Math.round(row.montant * 100), row.banque, (row.categorie || '').trim(), (row.description || '').trim(), row.date.slice(0, 10)])
export function compareHistory(expected, actual) {
  const counts = new Map()
  for (const row of actual) counts.set(key(row), (counts.get(key(row)) || 0) + 1)
  let missing = 0
  for (const row of expected) {
    const fingerprint = key(row)
    if (counts.get(fingerprint)) counts.set(fingerprint, counts.get(fingerprint) - 1)
    else missing++
  }
  const extra = [...counts.values()].reduce((sum, count) => sum + count, 0)
  const summarize = rows => {
    const dates = rows.map(row => row.date.slice(0, 10)).sort()
    return { count: rows.length, income: rows.filter(row => row.type === 'Entrée').reduce((n, row) => n + Math.round(row.montant * 100), 0), expenses: rows.filter(row => row.type === 'Sortie').reduce((n, row) => n + Math.round(row.montant * 100), 0), first: dates[0] || '—', last: dates.at(-1) || '—' }
  }
  return { identical: missing === 0 && extra === 0, missing, extra, source: summarize(expected), destination: summarize(actual) }
}
