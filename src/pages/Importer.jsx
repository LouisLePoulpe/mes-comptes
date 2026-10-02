import { useRef, useState } from 'react'
import { useData } from '../data/context'
import { parseExport } from '../transfer/parse'
import { planImport } from '../transfer/plan'
import { commitImport } from '../transfer/import'

export default function Importer({ cryptoKey, onClose }) {
  const { uid, accounts, categories, transactions } = useData()
  const [source, setSource] = useState(null)
  const [mapping, setMapping] = useState({})
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [progress, setProgress] = useState(0)
  const guard = useRef(false)
  async function choose(event) {
    const file = event.target.files?.[0]
    if (!file || guard.current) return
    guard.current = true; setBusy(true); setError(''); setSource(null); setPlan(null); setResult(null)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Le fichier dépasse 10 Mo.')
      const parsed = parseExport(await file.arrayBuffer(), file.name)
      setSource({ ...parsed, name: file.name })
      setMapping(Object.fromEntries([...new Set(parsed.records.map(t => t.banque))].map(bank => [bank, accounts.find(a => a.id === bank || a.name === bank)?.id || '__new__'])))
    } catch (error) { setError(error.message || 'Fichier illisible.') }
    finally { guard.current = false; setBusy(false) }
  }
  async function preview() {
    if (guard.current) return
    guard.current = true; setBusy(true); setError('')
    try { setPlan(await planImport(source.records, mapping, transactions, accounts, categories)) }
    catch (error) { setError(error.message) }
    finally { guard.current = false; setBusy(false) }
  }
  async function save() {
    if (guard.current) return
    guard.current = true; setBusy(true); setError(''); setProgress(0)
    try { setResult(await commitImport(uid, cryptoKey, plan, setProgress)); setPlan(null) }
    catch { setError('Import interrompu. Les lignes déjà ajoutées sont conservées. Tu peux réessayer sans les écraser ni les importer deux fois.') }
    finally { guard.current = false; setBusy(false) }
  }
  return <section className="max-w-2xl mx-auto space-y-4">
    <div className="flex justify-between items-center gap-3"><h2 className="text-2xl font-bold">Importer un historique</h2><button disabled={busy} onClick={onClose}>Retour</button></div>
    <p>Choisis l’export Excel de l’ancienne application, ou un CSV avec Type, Montant, Banque, Catégorie, Description et Date. Toutes les dates sont conservées. Les données seront ajoutées à ton coffre, sans remplacer ton historique.</p>
    <label className="block">Fichier à importer<input className="block w-full mt-2" type="file" accept=".xlsx,.csv" disabled={busy} onChange={choose} /></label>
    {error && <p role="alert" className="text-negative">{error}</p>}
    {source?.errors.length > 0 && <div role="alert" className="text-negative"><p>{source.errors.length} ligne(s) invalide(s). Corrige le fichier avant l’import ; aucune ligne n’a été ajoutée.</p><ul>{source.errors.slice(0, 20).map(error => <li key={error}>{error}</li>)}</ul></div>}
    {source && !source.errors.length && !result && <>
      <p>{source.records.length} transactions lues dans {source.name} ({source.sheet}).</p>
      <div className="space-y-3">{Object.keys(mapping).map(bank => <label key={bank} className="block">Compte pour {bank}
        <select className="block w-full bg-field border border-line rounded p-2" value={mapping[bank]} disabled={busy} onChange={event => { setMapping(previous => ({ ...previous, [bank]: event.target.value })); setPlan(null) }}>
          <option value="__new__">Créer « {bank} »</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>)}</div>
      <button className="bg-blue-600 text-white rounded px-4 py-2" disabled={busy} onClick={preview}>Préparer l’aperçu</button>
      {plan && <div className="bg-card rounded-xl p-4 space-y-3">
        <p>{plan.transactions.length} à ajouter · {plan.skipped} déjà présentes</p>
        <p>{plan.accounts.length} comptes et {plan.categories.length} catégories à créer.</p>
        <p className="text-sm text-muted">Les lignes identiques déjà présentes sont ignorées. Plusieurs lignes identiques dans le fichier sont conservées si elles n’existent pas encore.</p>
        <ul className="text-sm">{plan.transactions.slice(0, 5).map(row => <li key={row.id}>{row.data.date.slice(0, 10)} · {row.data.description || 'Sans description'} · {row.data.montant} €</li>)}</ul>
        <button className="bg-emerald-600 text-white rounded px-4 py-2" disabled={busy || !plan.transactions.length} onClick={save}>Confirmer l’import</button>
      </div>}
    </>}
    {busy && <p role="status">{progress ? `${progress} transactions traitées…` : 'Traitement en cours…'}</p>}
    {result && <p role="status">Import terminé : {result.created} ajoutées, {result.skipped} déjà présentes.</p>}
  </section>
}
