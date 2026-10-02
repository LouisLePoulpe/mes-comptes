import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { decrypt } from '../crypto'
import { userCollection } from './references'
import { DataContext } from './context'

const COLLECTIONS = ['transactions', 'categories', 'accounts']

// Mounted once per authenticated/unlocked session, above page navigation.
export default function DataProvider({ uid, cryptoKey, children }) {
  const [data, setData] = useState({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const stops = COLLECTIONS.map(name => {
      let revision = 0
      return onSnapshot(userCollection(uid, name), async snapshot => {
        const current = ++revision
        try {
          const rows = await Promise.all(snapshot.docs.map(async document => ({
            ...await decrypt(document.data(), cryptoKey), id: document.id,
          })))
          if (name === 'transactions') rows.sort((a, b) => new Date(a.date) - new Date(b.date))
          if (active && current === revision) setData(previous => ({ ...previous, [name]: { rows } }))
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
  const error = COLLECTIONS.map(name => data[name]?.error).find(Boolean)
  if (error) return <div className="p-4">
    <p role="alert">{error}</p>
    <button className="mt-3 rounded bg-emerald-600 px-4 py-2" onClick={() => { setData({}); setAttempt(value => value + 1) }}>Réessayer</button>
  </div>
  if (COLLECTIONS.some(name => !data[name]?.rows)) return <p>Chargement de ton historique…</p>
  const rows = Object.fromEntries(COLLECTIONS.map(name => [name, data[name].rows]))
  const accountName = id => rows.accounts.find(account => account.id === id)?.name || id
  return <DataContext.Provider value={{ ...rows, uid, accountName }}>{children}</DataContext.Provider>
}
