import { useState } from "react"
import { userDoc } from "../data/references"
import { useData } from "../data/context"
import { deleteDoc, updateDoc } from "firebase/firestore"
import { encrypt } from "../crypto"
import { Trash2, Pencil, X, Filter } from "lucide-react"
import * as XLSX from "xlsx"

function ModalEdition({ transaction, categories, cryptoKey, onClose, onSave }) {
  const { uid, accounts } = useData()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    type: transaction.type,
    montant: transaction.montant,
    banque: transaction.banque,
    categorie: transaction.categorie,
    description: transaction.description,
    date: transaction.date?.split("T")[0] ?? transaction.date
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const sauvegarder = async () => {
    if (saving) return
    setError("")
    if (!accounts.some(a => a.id === form.banque) || !Number.isFinite(Number(form.montant)) || Number(form.montant) <= 0 || !Number.isFinite(Date.parse(form.date))) return setError("Compte, montant et date valides requis")
    setSaving(true)
    try {
      const data = {
        ...form,
        montant: parseFloat(form.montant),
        date: new Date(form.date).toISOString()
      }
      const encrypted = await encrypt(data, cryptoKey)
      await updateDoc(userDoc(uid, "transactions", transaction.id), encrypted)
      onSave()
    } catch { setError("Modification impossible. Tes champs sont conservés, tu peux réessayer.") }
    finally { setSaving(false) }
  }

  const btnType = (t) => (
    <button
      onClick={() => set("type", t)}
      className={`flex-1 py-2 rounded-xl font-semibold transition ${
        form.type === t
          ? t === "Entrée" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
      }`}
    >{t}</button>
  )

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Modifier la transaction" className="bg-gray-900 rounded-2xl w-full max-w-md flex flex-col gap-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Modifier la transaction</h3>
          <button aria-label="Fermer la modification" onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X size={22} />
          </button>
        </div>

        <div className="flex gap-2">{btnType("Entrée")}{btnType("Sortie")}</div>

        <div>
          <label htmlFor="Historique-montant" className="text-sm text-gray-400 mb-1 block">Montant (€)</label>
          <input
            type="number"
            id="Historique-montant"
            value={form.montant}
            onChange={e => set("montant", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-xl focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1 block">Banque</label>
          <div className="flex gap-2">
            {accounts.map(({ id: b, name }) => (
              <button
                key={b}
                onClick={() => set("banque", b)}
                className={`flex-1 py-2 rounded-xl font-semibold transition ${
                  form.banque === b ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >{name}</button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="Historique-categorie" className="text-sm text-gray-400 mb-1 block">Catégorie</label>
          <select
            id="Historique-categorie"
            value={form.categorie}
            onChange={e => set("categorie", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">Sélectionner...</option>
            {categories.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="Historique-description" className="text-sm text-gray-400 mb-1 block">Description</label>
          <input
            id="Historique-description"
            value={form.description}
            onChange={e => set("description", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label htmlFor="Historique-date" className="text-sm text-gray-400 mb-1 block">Date</label>
          <input
            type="date"
            id="Historique-date"
            value={form.date}
            onChange={e => set("date", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {error && <p role="alert" className="text-red-400">{error}</p>}
        <div className="flex gap-3 mt-2">
          <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition">
            Annuler
          </button>
          <button disabled={saving} onClick={sauvegarder} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition">
            ✓ Sauvegarder
          </button>
        </div>
      </div>
    </div>
  )
}

const MOIS_NOMS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

export default function Historique({ cryptoKey }) {
  const { uid, transactions, categories, accounts, accountName } = useData()
  const [filtres, setFiltres] = useState({ banque: "", categorie: "", type: "", mois: "", annee: "" })
  const [enEdition, setEnEdition] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [error, setError] = useState("")



  const supprimer = async (id) => {
    if (confirm("Supprimer cette transaction ?")) {
      setError("")
      try { await deleteDoc(userDoc(uid, "transactions", id)) }
      catch { setError("Suppression impossible. La transaction a été conservée.") }
    }
  }

  const exporter = () => {
    const data = transactions.map(t => ({
      Type: t.type,
      Montant: t.montant,
      Banque: accountName(t.banque),
      Catégorie: t.categorie,
      Description: t.description,
      Date: new Date(t.date).toLocaleDateString("fr-FR")
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Transactions")
    XLSX.writeFile(wb, "mes-comptes.xlsx")
  }

  const anneesDisponibles = [...new Set(transactions.map(t => new Date(t.date).getFullYear()).filter(Boolean))].sort().reverse()

  const moisDisponibles = [...new Set(transactions
    .filter(t => !filtres.annee || new Date(t.date).getFullYear() === parseInt(filtres.annee))
    .map(t => new Date(t.date).getMonth() + 1)
    .filter(Boolean)
  )].sort((a,b) => b - a)

  const filtrées = [...transactions].reverse().filter(t => {
    if (filtres.type && t.type !== filtres.type) return false
    if (filtres.banque && t.banque !== filtres.banque) return false
    if (filtres.categorie && t.categorie !== filtres.categorie) return false
    const d = new Date(t.date)
    if (filtres.annee && d.getFullYear() !== parseInt(filtres.annee)) return false
    if (filtres.mois && d.getMonth() + 1 !== parseInt(filtres.mois)) return false
    return true
  })

  const setF = (k, v) => {
    if (k === "annee") setFiltres(f => ({ ...f, annee: v, mois: "" }))
    else setFiltres(f => ({ ...f, [k]: v }))
  }

  const nbFiltresActifs = Object.values(filtres).filter(v => v !== "").length
  const categoriesListe = [...new Set(transactions.map(t => t.categorie).filter(Boolean))]

  return (
    <div className="max-w-2xl mx-auto">
      {enEdition && (
        <ModalEdition
          transaction={enEdition}
          categories={categories}
          cryptoKey={cryptoKey}
          onClose={() => setEnEdition(null)}
          onSave={() => setEnEdition(null)}
        />
      )}

      {/* Drawer filtres */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="relative bg-gray-900 rounded-t-3xl p-6 flex flex-col gap-4 z-10 max-h-[85vh] overflow-y-auto pb-24">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">Filtres</h3>
              <button onClick={() => setFiltres({ banque: "", categorie: "", type: "", mois: "", annee: "" })}
                className="text-sm text-emerald-400">
                Réinitialiser
              </button>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-2 block">Type</label>
              <div className="flex gap-2">
                {["Entrée", "Sortie"].map(t => (
                  <button key={t} onClick={() => setF("type", filtres.type === t ? "" : t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                      filtres.type === t ? "bg-emerald-500 text-white" : "bg-gray-800 text-gray-400"
                    }`}>{t}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-2 block">Banque</label>
              <div className="flex gap-2">
                {accounts.map(({ id: b, name }) => (
                  <button key={b} onClick={() => setF("banque", filtres.banque === b ? "" : b)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                      filtres.banque === b ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-400"
                    }`}>{name}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-2 block">Catégorie</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categoriesListe.map(c => (
                  <button key={c} onClick={() => setF("categorie", filtres.categorie === c ? "" : c)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
                      filtres.categorie === c ? "bg-purple-500 text-white" : "bg-gray-800 text-gray-400"
                    }`}>{c}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-2 block">Année</label>
                <select value={filtres.annee} onChange={e => setF("annee", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
                  <option value="">Toutes</option>
                  {anneesDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-2 block">Mois</label>
                <select value={filtres.mois} onChange={e => setF("mois", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
                  <option value="">Tous</option>
                  {moisDisponibles.map(m => <option key={m} value={m}>{MOIS_NOMS[m-1]}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={() => setDrawerOpen(false)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition mt-2"
            >
              Appliquer
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-red-400">{error}</p>}
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Historique</h2>
        <button
          onClick={exporter}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl transition"
        >Export Excel</button>
      </div>

      {/* Bouton Filtrer */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">
          {filtrées.length} transaction{filtrées.length > 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setDrawerOpen(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            nbFiltresActifs > 0 ? "bg-emerald-500 text-white" : "bg-gray-800 text-gray-300"
          }`}
        >
          <Filter size={16} />
          Filtrer
          {nbFiltresActifs > 0 && (
            <span className="bg-white text-emerald-500 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
              {nbFiltresActifs}
            </span>
          )}
        </button>
      </div>

      {/* Liste */}
      <div className="flex flex-col gap-2">
        {filtrées.length === 0 && (
          <p className="text-gray-500 text-center py-12">Aucune transaction</p>
        )}
        {filtrées.map(t => (
          <div key={t.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className={`text-lg font-bold shrink-0 ${t.type === "Entrée" ? "text-emerald-400" : "text-red-400"}`}>
                {t.type === "Entrée" ? "+" : "-"}{t.montant}€
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.description || "—"}</p>
                <p className="text-xs text-gray-500">
                  {accountName(t.banque)} · {t.categorie} · {new Date(t.date).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button aria-label={`Modifier ${t.description || "la transaction"}`} onClick={() => setEnEdition(t)} className="text-gray-500 hover:text-blue-400 transition">
                <Pencil size={16} />
              </button>
              <button aria-label={`Supprimer ${t.description || "la transaction"}`} onClick={() => supprimer(t.id)} className="text-gray-500 hover:text-red-400 transition">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}