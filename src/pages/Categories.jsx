import { categoryGroup, DEFAULT_CATEGORIES } from '../domain/budget'
import Info from '../components/Info'
import { useState } from "react"
import { userCollection, userDoc } from "../data/references"
import { useData } from "../data/context"
import { addDoc, deleteDoc, updateDoc } from "../data/offline"
import { encrypt } from "../crypto"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"

export default function Categories({ cryptoKey }) {
  const { uid, transactions, categories } = useData()
  const [nouvelle, setNouvelle] = useState("")
  const [enEdition, setEnEdition] = useState(null)
  const [nouveauNom, setNouveauNom] = useState("")
  const [error, setError] = useState('')
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
    const encryptedCat = await encrypt({ nom: nouveauNom.trim(), budgetGroup: categoryGroup(cat) }, cryptoKey)
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

  async function changeGroup(cat, budgetGroup) {
    setLoading(true); setError('')
    try { await updateDoc(userDoc(uid, 'categories', cat.id), await encrypt({ nom: cat.nom, budgetGroup }, cryptoKey)) }
    catch { setError('Classement non enregistré. Réessaie.') } finally { setLoading(false) }
  }
  async function addDefaults() {
    setLoading(true); setError('')
    try { for (const { nom, budgetGroup } of DEFAULT_CATEGORIES) {
      if (!categories.some(cat => categoryGroup(cat) === budgetGroup)) await addDoc(userCollection(uid,'categories'), await encrypt({nom,budgetGroup},cryptoKey))
    } } catch { setError('Ajout incomplet. Tu peux réessayer.') } finally { setLoading(false) }
  }
  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Catégories</h2>

      <Info title="Classement des catégories"><p>Classe chaque catégorie pour le budget 50 / 20 / 30. Les catégories importées reconnues sont préclassées ; « Retrait d’épargne » diminue l’épargne.</p></Info>
      {error && <p role="alert">{error}</p>}
      <button disabled={loading} onClick={addDefaults} className="mb-4 text-link">Compléter les trois catégories par défaut</button>
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
          <div key={cat.id} className="flex flex-wrap items-center justify-between gap-2 bg-card rounded-xl px-4 py-3">
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

            <label className="w-full text-sm">Groupe de {cat.nom}<select aria-label={`Groupe de ${cat.nom}`} disabled={loading} className="block w-full bg-field rounded-lg p-2" value={categoryGroup(cat)} onChange={e => changeGroup(cat,e.target.value)}>
              <option value="none">Hors budget / à classer</option><option value="charges">Charges</option><option value="savings">Épargne</option><option value="fun">Plaisirs</option><option value="savingsWithdrawal">Retrait d’épargne</option>
            </select></label>
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
