export async function digest(value) {
  const bytes = new TextEncoder().encode(value)
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
}
const fingerprint = t => JSON.stringify([t.type, Math.round(t.montant * 100), t.banque, t.categorie.trim(), (t.description || '').trim(), t.date.slice(0, 10)])
export async function planImport(records, mapping, existing, accounts, categories) {
  const accountWrites = new Map(), categoryWrites = new Map(), seen = new Map()
  const candidates = []
  for (const record of records) {
    let accountId = mapping[record.banque]
    if (!accountId) throw new Error(`Choisis un compte pour ${record.banque}.`)
    if (accountId === '__new__') {
      accountId = `import_${await digest(record.banque)}`
      if (!accounts.some(a => a.id === accountId)) accountWrites.set(accountId, { name: record.banque, color: '#2563eb' })
    } else if (!accounts.some(a => a.id === accountId)) throw new Error('Un compte de destination a changé. Recommence l’aperçu.')
    const data = { ...record, banque: accountId }
    const key = fingerprint(data)
    const occurrence = (seen.get(key) || 0) + 1
    seen.set(key, occurrence)
    candidates.push({ id: `import_${await digest(key)}_${occurrence}`, data, key })
  }
  const candidateIds = new Set(candidates.map(row => row.id))
  const existingIds = new Set(existing.map(row => row.id))
  const counts = new Map()
  for (const row of existing) {
    // A known import ID already represents its own occurrence, even if edited.
    if (!candidateIds.has(row.id)) counts.set(fingerprint(row), (counts.get(fingerprint(row)) || 0) + 1)
  }
  const writes = []
  let skipped = 0
  for (const {id, data, key} of candidates) {
    if (existingIds.has(id)) { skipped++; continue }
    if (counts.get(key) > 0) { counts.set(key, counts.get(key) - 1); skipped++; continue }
    writes.push({ id, data })
    if (!categories.some(c => c.nom === data.categorie)) categoryWrites.set(`import_${await digest(data.categorie)}`, { nom: data.categorie })
  }
  const usedAccounts = new Set(writes.map(row => row.data.banque))
  return { transactions: writes, accounts: [...accountWrites].filter(([id]) => usedAccounts.has(id)).map(([id, data]) => ({ id, data })), categories: [...categoryWrites].map(([id, data]) => ({ id, data })), skipped }
}
