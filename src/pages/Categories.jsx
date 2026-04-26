import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs } from "firebase/firestore"
import { encrypt, decrypt } from "../crypto"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"

export default function Categories({ cryptoKey }) {
  const [categories, setCategories] = useState([])
  const [nouvelle, setNouvelle] = useState("")
  const [enEdition, setEnEdition] = useState(null)
  const [nouveauNom, setNouveauNom] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), async (snap) => {
      const decrypted = await Promise.all(snap.docs.map(async d => {
        try {
          const data = await decrypt(d.data(), cryptoKey)
          return { id: d.id, ...data }
        } catch {
          return null
        }
      }))
      setCategories(decrypted.filter(Boolean))
    })
    return unsub
  }, [cryptoKey])

  const ajouter = async () => {
    if (!nouvelle.trim()) return
    const encrypted = await encrypt({ nom: nouvelle.trim() }, cryptoKey)
    await addDoc(collection(db, "categories"), encrypted)
    setNouvelle("")
  }

  const supprimer = async (id) => {
    if (confirm("Supprimer cette catégorie ?")) {
      await deleteDoc(doc(db, "categories", id))
    }
  }

  const startEdit = (cat) => {
    setEnEdition(cat.id)
    setNouveauNom(cat.nom)
  }

  const cancelEdit = () => {
    setEnEdition(null)
    setNouveauNom("")
  }

  const sauvegarderNom = async (cat) => {
    if (!nouveauNom.trim() || nouveauNom === cat.nom) {
      cancelEdit()
      return
    }
    setLoading(true)

    // 1. Mettre à jour la catégorie
    const encryptedCat = await encrypt({ nom: nouveauNom.trim() }, cryptoKey)
    await updateDoc(doc(db, "categories", cat.id), encryptedCat)

    // 2. Mettre à jour toutes les transactions qui utilisent cette catégorie
    const transSnap = await getDocs(collection(db, "transactions"))
    const updates = []
    for (const d of transSnap.docs) {
      try {
        const data = await decrypt(d.data(), cryptoKey)
        if (data.categorie === cat.nom) {
          const updated = { ...data, categorie: nouveauNom.trim() }
          const encrypted = await encrypt(updated, cryptoKey)
          updates.push(updateDoc(doc(db, "transactions", d.id), encrypted))
        }
      } catch {
        // ignore
      }
    }
    await Promise.all(updates)
    console.log(`✅ ${updates.length} transactions mises à jour`)

    setEnEdition(null)
    setNouveauNom("")
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Catégories</h2>

      {loading && (
        <div className="bg-gray-800 rounded-xl p-3 mb-4 text-center text-sm text-emerald-400">
          Mise à jour des transactions en cours...
        </div>
      )}

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
            {enEdition === cat.id ? (
              <input
                value={nouveauNom}
                onChange={e => setNouveauNom(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") sauvegarderNom(cat)
                  if (e.key === "Escape") cancelEdit()
                }}
                autoFocus
                className="flex-1 bg-gray-700 border border-emerald-500 rounded-lg px-3 py-1 text-white focus:outline-none mr-2"
              />
            ) : (
              <span className="flex-1">{cat.nom}</span>
            )}

            <div className="flex gap-2 shrink-0">
              {enEdition === cat.id ? (
                <>
                  <button onClick={() => sauvegarderNom(cat)} className="text-emerald-400 hover:text-emerald-300 transition">
                    <Check size={18} />
                  </button>
                  <button onClick={cancelEdit} className="text-gray-500 hover:text-white transition">
                    <X size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(cat)} className="text-gray-500 hover:text-blue-400 transition">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => supprimer(cat.id)} className="text-gray-500 hover:text-red-400 transition">
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}