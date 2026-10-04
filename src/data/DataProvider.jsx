import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { setDoc } from './offline'
import { decrypt, encrypt } from '../crypto'
import { userCollection, userDoc } from './references'
import { DataContext } from './context'

const COLLECTIONS = ['transactions', 'categories', 'accounts', 'preferences']

// Mounted once per authenticated/unlocked session, above page navigation.
export default function DataProvider({ uid, cryptoKey, children }) {
  const [data, setData] = useState({})
  const [attempt, setAttempt] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  const [syncError, setSyncError] = useState(false)
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
  return <DataContext.Provider value={{ ...rows, preferences, savePreferences, uid, accountName }}>
    <p aria-live="polite" aria-label="Synchronisation" className="text-sm text-muted mb-3">{!online ? (pending ? 'Hors connexion · modifications enregistrées sur cet appareil, en attente de synchronisation.' : 'Hors connexion · historique disponible sur cet appareil.') : pending ? 'Modifications enregistrées sur cet appareil · synchronisation en cours…' : cached ? 'Vérification de la synchronisation…' : 'Synchronisé'}</p>
    {syncError && <p role="alert">Le serveur a refusé une modification. Vérifie ton historique et exporte tes données avant de te déconnecter.</p>}
    {children}
  </DataContext.Provider>
}
