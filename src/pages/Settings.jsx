import { useState } from 'react'
import { useData } from '../data/context'
import { orderedCards } from '../domain/trend'
import ThemeToggle from '../components/ThemeToggle'
export default function Settings({ user, onImport, onAccounts, onCategories }) {
  const { accounts, preferences, savePreferences } = useData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState({})
  const view = { ...preferences, ...pending }
  const cards = orderedCards(accounts, view.cardOrder)
  async function save(patch) { setPending(patch); setBusy(true); setError(''); try { await savePreferences(patch) } catch { setError('Préférence non enregistrée. Réessaie.') } finally { setPending({}); setBusy(false) } }
  function move(index, delta) { const next = [...cards]; [next[index], next[index+delta]] = [next[index+delta],next[index]]; save({cardOrder: next}) }
  return <section className="max-w-2xl mx-auto space-y-5">
    <h2 className="text-2xl font-bold">Paramètres</h2>
    <div className="settings-grid"><button className="settings-tile" onClick={onAccounts}><strong>Comptes</strong><span>Mes banques et leurs couleurs →</span></button><button className="settings-tile" onClick={onCategories}><strong>Catégories</strong><span>Organiser mes opérations →</span></button></div>
    <div className="bg-card rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between"><div><h3 className="font-semibold">Apparence</h3><p className="text-sm text-muted">Choisis le mode qui te convient.</p></div><ThemeToggle /></div>
    <div className="bg-card rounded-xl p-4 space-y-3">
      <h3 className="font-semibold">Disposition du Dashboard</h3><p className="text-sm text-muted">Ordre de lecture : de gauche à droite, puis de haut en bas.</p>
      {error && <p role="alert">{error}</p>}
      <ol aria-label="Ordre des cartes">{cards.map((id,index) => { const name = id === 'consumption' ? 'Consommation' : accounts.find(a=>a.id===id)?.name; return <li key={id} className="flex items-center justify-between gap-2 py-2"><span>{name}</span><span className="flex gap-3"><button disabled={busy || index === 0} aria-label={`Monter ${name}`} onClick={()=>move(index,-1)}>↑</button><button disabled={busy || index === cards.length-1} aria-label={`Descendre ${name}`} onClick={()=>move(index,1)}>↓</button></span></li>})}</ol>
      <label className="flex gap-2 items-center"><input type="checkbox" checked={view.showTrendValues === true} disabled={busy} onChange={e=>save({showTrendValues:e.target.checked})} />Afficher les valeurs de tendance</label>
    </div>
    <div className="bg-card rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Compte connecté</h3>
      <p>Adresse e-mail : <span className="break-all">{user.email || 'Non renseignée'}</span></p>
      <p className="text-sm text-muted break-all">Identifiant : {user.uid}</p>
    </div>
    <div className="bg-card rounded-xl p-4 space-y-3">
      <h3 className="font-semibold">Reprendre un ancien historique</h3>
      <p>Crée ton nouveau compte avec ta nouvelle adresse, puis importe l’export complet de l’ancien compte. Garde l’ancien compte et le fichier jusqu’à la fin des vérifications.</p>
      <button className="bg-blue-600 text-white rounded px-4 py-2" onClick={onImport}>Importer ou vérifier un export</button>
      <p className="text-sm text-muted">La comparaison vérifie les transactions contenues dans le fichier. Elle ne prouve pas que l’export de départ contient tout l’ancien historique. Aucune suppression de compte n’est effectuée ici.</p>
    </div>
  </section>
}
