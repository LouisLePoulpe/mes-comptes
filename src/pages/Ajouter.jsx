import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, onSnapshot, Timestamp } from "firebase/firestore"

export default function Ajouter({ onSuccess }) {
  const [form, setForm] = useState({
    type: "Sortie",
    montant: "",
    banque: "BB",
    categorie: "",
    description: "",
    date: new Date().toISOString().split("T")[0]
  })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.montant || !form.categorie) return alert("Montant et catégorie requis")
    setLoading(true)
    await addDoc(collection(db, "transactions"), {
      ...form,
      montant: parseFloat(form.montant),
      date: Timestamp.fromDate(new Date(form.date))
    })
    setLoading(false)
    onSuccess()
  }

  const btnType = (t) => (
    <button
      onClick={() => set("type", t)}
      className={`flex-1 py-2 rounded-xl font-semibold transition ${
        form.type === t
          ? t === "Entrée" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
      }`}
    >{t}</button>
  )

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <h2 className="text-2xl font-bold">Ajouter une transaction</h2>

      {/* Type */}
      <div className="flex gap-2">{btnType("Entrée")}{btnType("Sortie")}</div>

      {/* Montant */}
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Montant (€)</label>
        <input
          type="number"
          value={form.montant}
          onChange={e => set("montant", e.target.value)}
          placeholder="0"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-xl focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Banque */}
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

      {/* Catégorie */}
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

      {/* Description */}
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Description</label>
        <input
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Ex: Courses, Salaire KNDS..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Date */}
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Date</label>
        <input
          type="date"
          value={form.date}
          onChange={e => set("date", e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      <button
        onClick={submit}
        disabled={loading}
        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition text-lg mt-2"
      >
        {loading ? "Enregistrement..." : "✓ Enregistrer"}
      </button>
    </div>
  )
}