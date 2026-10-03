import { useState } from 'react'
import { useData } from '../data/context'
import { orderedCards } from '../domain/trend'
import ThemeToggle from '../components/ThemeToggle'
import Info from '../components/Info'
import { BUDGET_GROUPS } from '../domain/budget'
export default function Settings({ user, onImport, onAccounts, onCategories, onDelete }) {
  const { accounts, preferences, savePreferences } = useData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState({})
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const view = { ...preferences, ...pending }
  const cards = orderedCards(accounts, view.cardOrder)
  async function save(patch) { setPending(patch); setBusy(true); setError(''); try { await savePreferences(patch) } catch { setError('Préférence non enregistrée. Réessaie.') } finally { setPending({}); setBusy(false) } }
  function move(index, delta) { const next = [...cards]; [next[index], next[index+delta]] = [next[index+delta],next[index]]; save({cardOrder: next}) }
  return <section className="max-w-2xl mx-auto space-y-5">
    <h2 className="text-2xl font-bold">Paramètres</h2>
    <div className="settings-grid"><button className="settings-tile" onClick={onAccounts}><strong>Comptes</strong><span>Mes banques et leurs couleurs →</span></button><button className="settings-tile" onClick={onCategories}><strong>Catégories</strong><span>Organiser mes opérations →</span></button></div>
    <div className="bg-card rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between"><h3 className="font-semibold">Apparence</h3><ThemeToggle /></div>
    <div className="bg-card rounded-xl p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">Disposition du Dashboard <Info title="Disposition"><p>Les cartes apparaissent dans cet ordre, de gauche à droite puis de haut en bas.</p></Info></h3>
      {error && <p role="alert">{error}</p>}
      <ol aria-label="Ordre des cartes">{cards.map((id,index) => { const name = id === 'consumption' ? 'Consommation' : accounts.find(a=>a.id===id)?.name; return <li key={id} className="flex items-center justify-between gap-2 py-2"><span>{name}</span><span className="flex gap-3"><button disabled={busy || index === 0} aria-label={`Monter ${name}`} onClick={()=>move(index,-1)}>↑</button><button disabled={busy || index === cards.length-1} aria-label={`Descendre ${name}`} onClick={()=>move(index,1)}>↓</button></span></li>})}</ol>
      <label className="flex gap-2 items-center"><input type="checkbox" checked={view.showTrendValues === true} disabled={busy} onChange={e=>save({showTrendValues:e.target.checked})} />Afficher les valeurs de tendance</label>
    </div>
    <div className="bg-card rounded-xl p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">Couleurs du camembert <Info title="Couleurs du camembert"><p>Ces couleurs servent aux trois parts du budget. La couleur du texte indique si l'objectif est respecté.</p></Info></h3>
      <div className="grid grid-cols-3 gap-3">{BUDGET_GROUPS.map(group => <label key={group.id} className="text-sm flex items-center gap-2"><input type="color" value={view.budgetColors?.[group.id] || group.color} onChange={event => save({ budgetColors: { ...(view.budgetColors || {}), [group.id]: event.target.value } })} /><span>{group.name}</span></label>)}</div>
    </div>
    <div className="bg-card rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Compte connecté</h3>
      <p>Adresse e-mail : <span className="break-all">{user.email || 'Non renseignée'}</span></p>
      <p className="text-sm text-muted break-all">Identifiant : {user.uid}</p>
    </div>
    <div className="bg-card rounded-xl p-4 space-y-3">
      <h3 className="font-semibold">Reprendre un ancien historique <Info title="Import et vérification"><p>Importe l’export complet de l’ancien compte et conserve cet ancien compte jusqu’à la fin des vérifications. La comparaison porte sur les transactions du fichier ; elle ne prouve pas que le fichier contient tout l’ancien historique.</p></Info></h3>
      <button className="bg-blue-600 text-white rounded px-4 py-2" onClick={onImport}>Importer ou vérifier un export</button>
    </div>
    <div className="bg-card rounded-xl p-4 space-y-3 border border-negative">
      <h3 className="font-semibold text-negative">Supprimer le compte</h3>
      <p className="text-sm text-muted">Cette action est définitive : opérations, comptes bancaires, catégories, paramètres et accès seront supprimés. Ferme les autres sessions et conserve un export si nécessaire.</p>
      {!deleteOpen ? <button className="rounded px-4 py-2 bg-negative text-white" onClick={() => setDeleteOpen(true)}>Supprimer définitivement</button> : <form className="space-y-3" onSubmit={event => { event.preventDefault(); onDelete({ password: deletePassword }); }}>
        {user.providerData.some(provider => provider.providerId === 'password') && <input type="password" required value={deletePassword} onChange={event => setDeletePassword(event.target.value)} placeholder="Mot de passe actuel" aria-label="Mot de passe actuel" className="bg-field rounded p-2 w-full" />}
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" required /> Je comprends que mes données seront supprimées définitivement.</label>
        <div className="flex gap-2"><button className="rounded px-4 py-2 bg-negative text-white" type="submit">Confirmer la suppression</button><button type="button" onClick={() => setDeleteOpen(false)}>Annuler</button></div>
      </form>}
    </div>
  </section>
}
