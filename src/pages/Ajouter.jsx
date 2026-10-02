import { useState } from "react"
import { userCollection } from "../data/references"
import { useData } from "../data/context"
import { addDoc } from "firebase/firestore"
import { encrypt } from "../crypto"

export default function Ajouter({ cryptoKey, onSuccess }) {
  const { uid, categories, accounts } = useData()
  const [form, setForm] = useState({
    type: "Sortie",
    montant: "",
    banque: accounts[0]?.id || "",
    categorie: "",
    description: "",
    date: new Date().toISOString().split("T")[0]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")


  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (loading) return
    setError("")
    if (!accounts.some(a => a.id === form.banque)) return setError("Choisis un compte dans la liste. Tu peux en créer un dans Comptes.")
    if (!Number.isFinite(Number(form.montant)) || Number(form.montant) <= 0) return setError("Saisis un montant supérieur à zéro.")
    if (!form.date || !Number.isFinite(Date.parse(form.date))) return setError("Choisis une date valide.")
    if (!form.categorie) return setError("Choisis une catégorie.")
    setLoading(true)
    try {
      const data = {
        ...form,
        montant: parseFloat(form.montant),
        date: new Date(form.date).toISOString()
      }
      const encrypted = await encrypt(data, cryptoKey)
      await addDoc(userCollection(uid, "transactions"), encrypted)
      onSuccess()
    } catch { setError("Enregistrement impossible. Tes champs sont conservés, tu peux réessayer.") }
    finally { setLoading(false) }
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

      {error && <p role="alert" className="text-red-400">{error}</p>}
      {!accounts.length && <p>Crée un compte dans Comptes avant de saisir une transaction.</p>}

      <div className="flex gap-2">{btnType("Entrée")}{btnType("Sortie")}</div>

      <div>
        <label htmlFor="Ajouter-montant" className="text-sm text-gray-400 mb-1 block">Montant (€)</label>
        <input
          type="number"
          id="Ajouter-montant"
          value={form.montant}
          onChange={e => set("montant", e.target.value)}
          placeholder="0"
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
        <label htmlFor="Ajouter-categorie" className="text-sm text-gray-400 mb-1 block">Catégorie</label>
        <select
          id="Ajouter-categorie"
          value={form.categorie}
          onChange={e => set("categorie", e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">Sélectionner...</option>
          {categories.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="Ajouter-description" className="text-sm text-gray-400 mb-1 block">Description</label>
        <input
          id="Ajouter-description"
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Ex: Courses, Salaire KNDS..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label htmlFor="Ajouter-date" className="text-sm text-gray-400 mb-1 block">Date</label>
        <input
          type="date"
          id="Ajouter-date"
          value={form.date}
          onChange={e => set("date", e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      <button
        onClick={submit}
        disabled={loading || !accounts.length}
        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition text-lg mt-2"
      >
        {loading ? "Enregistrement..." : "✓ Enregistrer"}
      </button>
    </div>
  )
}