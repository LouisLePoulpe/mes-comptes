import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { setDoc } from './offline'
import { decrypt, encrypt } from '../crypto'
import { userCollection, userDoc } from './references'
import { DataContext } from './context'
import { planRecurringOccurrences } from '../domain/recurring'

const COLLECTIONS = ['transactions', 'categories', 'accounts', 'initialBalances', 'recurringRules', 'preferences']
const EMPTY_ROWS = Object.freeze([])

function localDay() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

// Mounted once per authenticated/unlocked session, above page navigation.
export default function DataProvider({ uid, cryptoKey, children }) {
  const [data, setData] = useState({})
  const [attempt, setAttempt] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  const [syncError, setSyncError] = useState(false)
  const [recurringError, setRecurringError] = useState('')
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    const failed = () => setSyncError(true)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener('poulpecule-sync-error', failed)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener('poulpecule-sync-error', failed)
    }
  }, [])
  useEffect(() => {
    let active = true
    const stops = COLLECTIONS.map(name => {
      let revision = 0
      return onSnapshot(name === 'preferences' ? userDoc(uid, 'config', 'dashboard') : userCollection(uid, name), { includeMetadataChanges: true }, async snapshot => {
        const current = ++revision
        try {
          const rows = await Promise.all((name === 'preferences' ? (snapshot.exists() ? [snapshot] : []) : snapshot.docs).map(async document => ({
            ...await decrypt(document.data(), cryptoKey), id: document.id,
          })))
          if (name === 'accounts' || name === 'categories') rows.sort((a,b) => (a.name || a.nom).localeCompare(b.name || b.nom, 'fr', { numeric: true, sensitivity: 'base' }))
          if (name === 'transactions') rows.sort((a, b) => new Date(a.date) - new Date(b.date))
          if (name === 'initialBalances') rows.sort((a, b) => new Date(a.date) - new Date(b.date) || (a.label || '').localeCompare(b.label || '', 'fr'))
          if (name === 'recurringRules') rows.sort((a, b) => new Date(a.startDate) - new Date(b.startDate) || (a.description || '').localeCompare(b.description || '', 'fr'))
          if (active && current === revision) setData(previous => ({ ...previous, [name]: { rows, pending: snapshot.metadata.hasPendingWrites, cached: snapshot.metadata.fromCache } }))
        } catch {
          if (active && current === revision) setData(previous => ({ ...previous, [name]: {
            error: 'Impossible de déchiffrer les données. Aucun historique partiel ne sera affiché.',
          } }))
        }
      }, () => {
        revision++ // Invalidate decryptions that were still in flight when the listener failed.
        if (active) setData(previous => ({ ...previous, [name]: {
          error: 'Accès aux données impossible. Vérifie ta connexion et les autorisations.',
        } }))
      })
    })
    return () => { active = false; stops.forEach(stop => stop()) }
  }, [uid, cryptoKey, attempt])
  const transactionRows =
    data.transactions?.rows ||
    EMPTY_ROWS

  const recurringRows =
    data.recurringRules?.rows ||
    EMPTY_ROWS

  const categoryRows =
    data.categories?.rows ||
    EMPTY_ROWS

  const accountRows =
    data.accounts?.rows ||
    EMPTY_ROWS

  const dataReady =
    COLLECTIONS.every(
      name =>
        Boolean(
          data[name]?.rows
        )
    )

  useEffect(() => {
    if (!dataReady) return

    let cancelled = false

    /*
     * On décale la génération après
     * l'effet courant pour éviter une
     * mise à jour React synchrone depuis
     * le corps du useEffect.
     */
    Promise.resolve().then(
      async () => {
        if (cancelled) return

        let planned

        try {
          planned =
            planRecurringOccurrences({
              rules:
                recurringRows,

              transactions:
                transactionRows,

              categories:
                categoryRows,

              accounts:
                accountRows,

              throughDate:
                localDay(),
            })
        } catch {
          if (!cancelled) {
            setRecurringError(
              'Une périodicité est invalide. Vérifie-la dans Paramètres → Périodiques.'
            )
          }

          return
        }

        if (!planned.length) {
          if (!cancelled) {
            setRecurringError('')
          }

          return
        }

        try {
          for (
            const occurrence
            of planned
          ) {
            if (cancelled) return

            await setDoc(
              userDoc(
                uid,
                'transactions',
                occurrence.id
              ),
              await encrypt(
                occurrence.data,
                cryptoKey
              )
            )
          }

          if (!cancelled) {
            setRecurringError('')
          }
        } catch {
          if (!cancelled) {
            setRecurringError(
              'Certaines transactions périodiques n’ont pas pu être générées. Elles seront réessayées à la prochaine ouverture.'
            )
          }
        }
      }
    )

    return () => {
      cancelled = true
    }
  }, [
    uid,
    cryptoKey,
    dataReady,
    recurringRows,
    transactionRows,
    categoryRows,
    accountRows,
  ])

  const error = COLLECTIONS.map(name => data[name]?.error).find(Boolean)
  if (error) return <div className="p-4">
    <p role="alert">{error}</p>
    <button className="mt-3 rounded bg-emerald-600 px-4 py-2" onClick={() => { setData({}); setAttempt(value => value + 1) }}>Réessayer</button>
  </div>
  if (COLLECTIONS.some(name => !data[name]?.rows)) return <p>Chargement de ton historique…</p>
  const rows = Object.fromEntries(COLLECTIONS.map(name => [name, data[name].rows]))
  const preferences = rows.preferences[0] || {}
  const savePreferences = async patch => {
    const ref = userDoc(uid, 'config', 'dashboard')
    await setDoc(ref, await encrypt({ ...preferences, ...patch }, cryptoKey))
  }
  const accountName = id => rows.accounts.find(account => account.id === id)?.name || id
  const pending = COLLECTIONS.some(name => data[name].pending)
  const cached = COLLECTIONS.some(name => data[name].cached)
  const syncState = !online ? 'offline' : pending || cached ? 'syncing' : 'synced'
  return <DataContext.Provider value={{ ...rows, preferences, savePreferences, uid, accountName, syncState, pending }}>
    {syncError && <p role="alert">Le serveur a refusé une modification. Vérifie ton historique et exporte tes données avant de te déconnecter.</p>}
    {recurringError && <p role="alert">{recurringError}</p>}
    {children}
  </DataContext.Provider>
}
