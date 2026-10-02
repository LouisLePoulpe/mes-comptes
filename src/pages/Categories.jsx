import { useState } from "react"
import { userCollection, userDoc } from "../data/references"
import { useData } from "../data/context"
import { addDoc, deleteDoc, updateDoc } from "firebase/firestore"
import { encrypt } from "../crypto"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"

export default function Categories({ cryptoKey }) {
  const { uid, transactions, categories } = useData()
  const [nouvelle, setNouvelle] = useState("")
  const [enEdition, setEnEdition] = useState(null)
  const [nouveauNom, setNouveauNom] = useState("")
  const [loading, setLoading] = useState(false)


  const ajouter = async () => {
    if (!nouvelle.trim()) return
    const encrypted = await encrypt({ nom: nouvelle.trim() }, cryptoKey)
    await addDoc(userCollection(uid, "categories"), encrypted)
    setNouvelle("")
  }

  const supprimer = async (id) => {
    if (confirm("Supprimer cette catégorie ?")) {
      await deleteDoc(userDoc(uid, "categories", id))
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
    await updateDoc(userDoc(uid, "categories", cat.id), encryptedCat)

    // 2. Mettre à jour toutes les transactions qui utilisent cette catégorie
    const updates = transactions.filter(t => t.categorie === cat.nom).map(async ({ id, ...data }) => {
      const encrypted = await encrypt({ ...data, categorie: nouveauNom.trim() }, cryptoKey)
      await updateDoc(userDoc(uid, "transactions", id), encrypted)
    })
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
        <div className="bg-card rounded-xl p-3 mb-4 text-center text-sm text-positive">
          Mise à jour des transactions en cours...
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <input
          value={nouvelle}
          onChange={e => setNouvelle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && ajouter()}
          placeholder="Nouvelle catégorie..."
          className="flex-1 bg-card border border-line rounded-xl px-4 py-2 text-foreground placeholder-gray-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          aria-label="Ajouter la catégorie"
          onClick={ajouter}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center justify-between bg-card rounded-xl px-4 py-3">
            {enEdition === cat.id ? (
              <input
                value={nouveauNom}
                onChange={e => setNouveauNom(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") sauvegarderNom(cat)
                  if (e.key === "Escape") cancelEdit()
                }}
                autoFocus
                className="flex-1 bg-field border border-emerald-500 rounded-lg px-3 py-1 text-foreground focus:outline-none mr-2"
              />
            ) : (
              <span className="flex-1">{cat.nom}</span>
            )}

            <div className="flex gap-2 shrink-0">
              {enEdition === cat.id ? (
                <>
                  <button aria-label="Enregistrer le nom" onClick={() => sauvegarderNom(cat)} className="text-positive hover:text-emerald-300 transition">
                    <Check size={18} />
                  </button>
                  <button aria-label="Annuler la modification" onClick={cancelEdit} className="text-muted hover:text-foreground transition">
                    <X size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button aria-label={`Modifier ${cat.nom}`} onClick={() => startEdit(cat)} className="text-muted hover:text-link transition">
                    <Pencil size={18} />
                  </button>
                  <button aria-label={`Supprimer ${cat.nom}`} onClick={() => supprimer(cat.id)} className="text-muted hover:text-negative transition">
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