import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore"
import { Plus, Trash2 } from "lucide-react"

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [nouvelle, setNouvelle] = useState("")

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  const ajouter = async () => {
    if (!nouvelle.trim()) return
    await addDoc(collection(db, "categories"), { nom: nouvelle.trim() })
    setNouvelle("")
  }

  const supprimer = async (id) => {
    await deleteDoc(doc(db, "categories", id))
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Catégories</h2>
      <div className="flex gap-2 mb-6">
        <input
          value={nouvelle}
          onChange={e => setNouvelle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && ajouter()}
          placeholder="Nouvelle catégorie..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          onClick={ajouter}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition"
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
            <span>{cat.nom}</span>
            <button onClick={() => supprimer(cat.id)} className="text-gray-500 hover:text-red-400 transition">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}