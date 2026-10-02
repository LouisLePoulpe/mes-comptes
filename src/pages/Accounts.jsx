import { useState } from 'react'
import { addDoc, updateDoc } from 'firebase/firestore'
import { useData } from '../data/context'
import { userCollection, userDoc } from '../data/references'
import { encrypt } from '../crypto'

export default function Accounts({ cryptoKey }) {
  const { uid, accounts } = useData()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#60a5fa')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(event) {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const encrypted = await encrypt({ name: name.trim(), color }, cryptoKey)
      if (editing) await updateDoc(userDoc(uid, 'accounts', editing), encrypted)
      else await addDoc(userCollection(uid, 'accounts'), encrypted)
      setName(''); setEditing(null)
    } catch { setError('Enregistrement impossible. Réessaie.') }
    finally { setBusy(false) }
  }
  return <div className="max-w-md mx-auto space-y-4">
    <h2 className="text-2xl font-bold">Mes comptes</h2>
    <p>Les noms et couleurs peuvent changer sans modifier l’historique.</p>
    <form onSubmit={save} className="flex flex-wrap gap-2">
      <input aria-label="Nom du compte" required maxLength={100} value={name} onChange={e => setName(e.target.value)} className="bg-gray-800 rounded p-2" placeholder="Nom du compte" />
      <input aria-label="Couleur du compte" type="color" value={color} onChange={e => setColor(e.target.value)} />
      <button disabled={busy} className="bg-emerald-600 rounded p-2">{editing ? 'Enregistrer' : 'Ajouter'}</button>
      {editing && <button type="button" onClick={() => { setEditing(null); setName('') }}>Annuler</button>}
    </form>
    {error && <p role="alert">{error}</p>}
    {accounts.map(account => <div key={account.id} className="bg-gray-800 p-3 rounded flex justify-between">
      <span style={{ color: account.color }}>{account.name}</span>
      <button disabled={busy} onClick={() => { setEditing(account.id); setName(account.name); setColor(account.color) }}>Modifier</button>
    </div>)}
    {!accounts.length && <p>Ajoute ton premier compte pour saisir des transactions.</p>}
  </div>
}
