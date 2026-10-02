import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { decrypt } from '../crypto'
import { userCollection } from './references'
import { DataContext } from './context'

// Mounted once per authenticated/unlocked session, above page navigation.
export default function DataProvider({ uid, cryptoKey, children }) {
  const [data, setData] = useState({})
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const stops = ['transactions', 'categories', 'accounts'].map(name => {
      let revision = 0
      return onSnapshot(userCollection(uid, name), async snapshot => {
        const current = ++revision
        try {
          const rows = await Promise.all(snapshot.docs.map(async document => ({
            ...await decrypt(document.data(), cryptoKey), id: document.id,
          })))
          if (name === 'transactions') rows.sort((a, b) => new Date(a.date) - new Date(b.date))
          if (active && current === revision) setData(previous => ({ ...previous, [name]: rows }))
        } catch {
          if (active && current === revision) setError('Impossible de déchiffrer les données. Aucun historique partiel ne sera affiché.')
        }
      }, () => { if (active) setError('Accès aux données impossible. Vérifie ta connexion et les autorisations.') })
    })
    return () => { active = false; stops.forEach(stop => stop()) }
  }, [uid, cryptoKey])
  if (error) return <p role="alert">{error}</p>
  if (Object.keys(data).length !== 3) return <p>Chargement de ton historique…</p>
  const accountName = id => data.accounts.find(account => account.id === id)?.name || id
  return <DataContext.Provider value={{ ...data, uid, accountName }}>{children}</DataContext.Provider>
}
