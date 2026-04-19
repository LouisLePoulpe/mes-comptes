import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, onSnapshot, deleteDoc, doc, orderBy, query, updateDoc, Timestamp } from "firebase/firestore"
import { Trash2, Pencil, X } from "lucide-react"
import * as XLSX from "xlsx"

function ModalEdition({ transaction, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    type: transaction.type,
    montant: transaction.montant,
    banque: transaction.banque,
    categorie: transaction.categorie,
    description: transaction.description,
    date: transaction.date?.toDate?.().toISOString().split("T")[0] ?? transaction.date
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const sauvegarder = async () => {
    await updateDoc(doc(db, "transactions", transaction.id), {
      ...form,
      montant: parseFloat(form.montant),
      date: Timestamp.fromDate(new Date(form.date))
    })
    onSave()
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
      <div className="bg-gray-900 rounded-2xl w-full max-w-md flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Modifier la transaction</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X size={22} />
          </button>
        </div>

        <div className="flex gap-2">{btnType("Entrée")}{btnType("Sortie")}</div>

        <div>
          <label className="text-sm text-gray-400 mb-1 block">Montant (€)</label>
          <input
            type="number"
            value={form.montant}
            onChange={e => set("montant", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-xl focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1 block">Banque</label>
          <div className="flex gap-2">
            {["BB", "CMB", "TR"].map(b => (
              <button
                key={b}
                onClick={() => set("banque", b)}
                className={`flex-1 py-2 rounded-xl font-semibold transition ${
                  form.banque === b ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >{b}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1 block">Catégorie</label>
          <select
            value={form.categorie}
            onChange={e => set("categorie", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">Sélectionner...</option>
            {categories.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1 block">Description</label>
          <input
            value={form.description}
            onChange={e => set("description", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1 block">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => set("date", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex gap-3 mt-2">
          <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition">
            Annuler
          </button>
          <button onClick={sauvegarder} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition">
            ✓ Sauvegarder
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Historique() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [filtres, setFiltres] = useState({ banque: "", categorie: "", type: "", mois: "" })
  const [enEdition, setEnEdition] = useState(null)

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("date", "desc"))
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  const supprimer = async (id) => {
    if (confirm("Supprimer cette transaction ?")) {
      await deleteDoc(doc(db, "transactions", id))
    }
  }

  const exporter = () => {
    const data = transactions.map(t => ({
      Type: t.type,
      Montant: t.montant,
      Banque: t.banque,
      Catégorie: t.categorie,
      Description: t.description,
      Date: t.date?.toDate?.().toLocaleDateString("fr-FR") ?? t.date
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Transactions")
    XLSX.writeFile(wb, "mes-comptes.xlsx")
  }

  // Liste des mois disponibles
  const moisDisponibles = []
  const vus = new Set()
  transactions.forEach(t => {
    const d = t.date?.toDate?.()
    if (!d) return
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`
    if (!vus.has(key)) { vus.add(key); moisDisponibles.push(key) }
  })
  moisDisponibles.sort().reverse()

  const labelMois = (key) => {
    const [y, m] = key.split("-")
    return new Date(y, m-1).toLocaleDateString("fr-FR", { month:"long", year:"numeric" })
  }

  const filtrées = transactions.filter(t => {
    if (filtres.type && t.type !== filtres.type) return false
    if (filtres.banque && t.banque !== filtres.banque) return false
    if (filtres.categorie && t.categorie !== filtres.categorie) return false
    if (filtres.mois) {
      const d = t.date?.toDate?.()
      if (!d) return false
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`
      if (key !== filtres.mois) return false
    }
    return true
  })

  const setF = (k, v) => setFiltres(f => ({ ...f, [k]: v }))
  const categoriesListe = [...new Set(transactions.map(t => t.categorie).filter(Boolean))]

  return (
    <div className="max-w-2xl mx-auto">
      {enEdition && (
        <ModalEdition
          transaction={enEdition}
          categories={categories}
          onClose={() => setEnEdition(null)}
          onSave={() => setEnEdition(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Historique</h2>
        <button
          onClick={exporter}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl transition"
        >Export Excel</button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={filtres.type} onChange={e => setF("type", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
          <option value="">Tous types</option>
          <option>Entrée</option>
          <option>Sortie</option>
        </select>
        <select value={filtres.banque} onChange={e => setF("banque", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
          <option value="">Toutes banques</option>
          {["BB", "CMB", "TR"].map(b => <option key={b}>{b}</option>)}
        </select>
        <select value={filtres.categorie} onChange={e => setF("categorie", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
          <option value="">Toutes catégories</option>
          {categoriesListe.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filtres.mois} onChange={e => setF("mois", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
          <option value="">Tous les mois</option>
          {moisDisponibles.map(m => <option key={m} value={m}>{labelMois(m)}</option>)}
        </select>
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
                  {t.banque} · {t.categorie} · {t.date?.toDate?.().toLocaleDateString("fr-FR") ?? t.date}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setEnEdition(t)} className="text-gray-500 hover:text-blue-400 transition">
                <Pencil size={16} />
              </button>
              <button onClick={() => supprimer(t.id)} className="text-gray-500 hover:text-red-400 transition">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}