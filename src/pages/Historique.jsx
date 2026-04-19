import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, onSnapshot, deleteDoc, doc, orderBy, query } from "firebase/firestore"
import { Trash2 } from "lucide-react"
import * as XLSX from "xlsx"

export default function Historique() {
  const [transactions, setTransactions] = useState([])
  const [filtres, setFiltres] = useState({ banque: "", categorie: "", type: "" })

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("date", "desc"))
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
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

  const filtrées = transactions.filter(t =>
    (!filtres.banque || t.banque === filtres.banque) &&
    (!filtres.categorie || t.categorie === filtres.categorie) &&
    (!filtres.type || t.type === filtres.type)
  )

  const categories = [...new Set(transactions.map(t => t.categorie).filter(Boolean))]

  const setF = (k, v) => setFiltres(f => ({ ...f, [k]: v }))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Historique</h2>
        <button
          onClick={exporter}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl transition"
        >
          Export Excel
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={filtres.type}
          onChange={e => setF("type", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="">Tous types</option>
          <option>Entrée</option>
          <option>Sortie</option>
        </select>
        <select
          value={filtres.banque}
          onChange={e => setF("banque", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="">Toutes banques</option>
          {["BB", "CMB", "TR"].map(b => <option key={b}>{b}</option>)}
        </select>
        <select
          value={filtres.categorie}
          onChange={e => setF("categorie", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Liste */}
      <div className="flex flex-col gap-2">
        {filtrées.length === 0 && (
          <p className="text-gray-500 text-center py-12">Aucune transaction</p>
        )}
        {filtrées.map(t => (
          <div key={t.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold ${t.type === "Entrée" ? "text-emerald-400" : "text-red-400"}`}>
                {t.type === "Entrée" ? "+" : "-"}{t.montant}€
              </span>
              <div>
                <p className="text-sm font-medium">{t.description || "—"}</p>
                <p className="text-xs text-gray-500">
                  {t.banque} · {t.categorie} · {t.date?.toDate?.().toLocaleDateString("fr-FR") ?? t.date}
                </p>
              </div>
            </div>
            <button onClick={() => supprimer(t.id)} className="text-gray-600 hover:text-red-400 transition">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}