import {
  CATEGORY_ROLES,
  DEFAULT_CATEGORIES_V21,
  roleById,
} from "../domain/categoryRoles"
import Info from "../components/Info"
import { useState } from "react"
import { userCollection, userDoc } from "../data/references"
import { useData } from "../data/context"
import { addDoc, deleteDoc, setDoc, updateDoc } from "../data/offline"
import { encrypt } from "../crypto"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"

export default function Categories({ cryptoKey }) {
  const { uid, transactions, categories } = useData()

  const [nouvelle, setNouvelle] = useState("")
  const [nouveauRole, setNouveauRole] = useState("")
  const [enEdition, setEnEdition] = useState(null)
  const [nouveauNom, setNouveauNom] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const ajouter = async () => {
    const nom = nouvelle.trim()

    if (!nom) return setError("Donne un nom à la catégorie.")
    if (!nouveauRole) {
      return setError("Choisis le rôle de calcul de la catégorie.")
    }

    setLoading(true)
    setError("")

    try {
      const encrypted = await encrypt(
        {
          nom,
          roleId: nouveauRole,
          defaultRole: false,
        },
        cryptoKey
      )

      await addDoc(userCollection(uid, "categories"), encrypted)

      setNouvelle("")
      setNouveauRole("")
    } catch {
      setError("Impossible d'ajouter la catégorie.")
    } finally {
      setLoading(false)
    }
  }

  const supprimer = async cat => {
    const utilisées = transactions.filter(
      transaction =>
        transaction.categoryId === cat.id ||
        transaction.categorie === cat.nom
    )

    if (utilisées.length > 0) {
      setError(
        `Impossible de supprimer « ${cat.nom} » : ${utilisées.length} transaction(s) l'utilisent.`
      )
      return
    }

    if (!confirm(`Supprimer la catégorie « ${cat.nom} » ?`)) return

    try {
      await deleteDoc(userDoc(uid, "categories", cat.id))
    } catch {
      setError("Suppression impossible.")
    }
  }

  const startEdit = cat => {
    setEnEdition(cat.id)
    setNouveauNom(cat.nom)
    setError("")
  }

  const cancelEdit = () => {
    setEnEdition(null)
    setNouveauNom("")
  }

  const sauvegarderNom = async cat => {
    const nom = nouveauNom.trim()

    if (!nom || nom === cat.nom) {
      cancelEdit()
      return
    }

    setLoading(true)
    setError("")

    try {
      const { id, ...catData } = cat

      await updateDoc(
        userDoc(uid, "categories", id),
        await encrypt(
          {
            ...catData,
            nom,
          },
          cryptoKey
        )
      )

      /*
       * Les transactions V2.1 utilisent categoryId.
       * On conserve aussi le nom dans la transaction pour l'export et
       * pour les données créées avant cette évolution.
       */
      const updates = transactions
        .filter(
          transaction =>
            transaction.categoryId === cat.id ||
            transaction.categorie === cat.nom
        )
        .map(async transaction => {
          const { id: transactionId, ...data } = transaction

          await updateDoc(
            userDoc(uid, "transactions", transactionId),
            await encrypt(
              {
                ...data,
                categoryId: cat.id,
                categorie: nom,
              },
              cryptoKey
            )
          )
        })

      await Promise.all(updates)

      cancelEdit()
    } catch {
      setError("Impossible de renommer la catégorie.")
    } finally {
      setLoading(false)
    }
  }

  const addDefaults = async () => {
    setLoading(true)
    setError("")

    try {
      for (const category of DEFAULT_CATEGORIES_V21) {
        const existe = categories.some(
          existing =>
            existing.defaultRole === true &&
            existing.roleId === category.roleId
        )

        if (existe) continue

        const { id, ...data } = category

        await setDoc(
          userDoc(uid, "categories", id),
          await encrypt(data, cryptoKey)
        )
      }
    } catch {
      setError("Ajout incomplet des catégories par défaut. Réessaie.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Catégories</h2>

      <Info title="Rôles de calcul">
        <p>
          Chaque catégorie appartient à un rôle de calcul. Ce rôle détermine
          dans quels flux la catégorie peut être utilisée et comment elle
          intervient dans Entrées, Épargne, Charges et Plaisirs.
        </p>
        <p>
          Le nom peut être modifié librement. Le rôle de calcul reste stable
          afin de ne pas modifier rétroactivement tes statistiques.
        </p>
      </Info>

      {error && (
        <p role="alert" className="text-negative mt-3">
          {error}
        </p>
      )}

      <button
        disabled={loading}
        onClick={addDefaults}
        className="my-4 text-link"
      >
        Compléter les 9 catégories par défaut
      </button>

      <div className="bg-card rounded-xl p-4 mb-6 space-y-3">
        <h3 className="font-semibold">Nouvelle catégorie</h3>

        <input
          value={nouvelle}
          onChange={event => setNouvelle(event.target.value)}
          placeholder="Ex : ETF Monde 🌍"
          className="w-full bg-field border border-line rounded-xl px-4 py-2 text-foreground"
        />

        <select
          value={nouveauRole}
          onChange={event => setNouveauRole(event.target.value)}
          className="w-full bg-field border border-line rounded-xl px-4 py-2 text-foreground"
        >
          <option value="">Associer à un rôle...</option>

          {CATEGORY_ROLES.map(role => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>

        <button
          disabled={loading}
          onClick={ajouter}
          className="w-full flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl"
        >
          <Plus size={20} />
          Ajouter
        </button>
      </div>

      {loading && (
        <div className="bg-card rounded-xl p-3 mb-4 text-center text-sm text-positive">
          Mise à jour en cours...
        </div>
      )}

      <div className="flex flex-col gap-2">
        {categories.map(cat => {
          const role = roleById(cat.roleId)

          return (
            <div
              key={cat.id}
              className="bg-card rounded-xl px-4 py-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                {enEdition === cat.id ? (
                  <input
                    value={nouveauNom}
                    onChange={event => setNouveauNom(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter") sauvegarderNom(cat)
                      if (event.key === "Escape") cancelEdit()
                    }}
                    autoFocus
                    className="flex-1 bg-field border border-emerald-500 rounded-lg px-3 py-1 text-foreground"
                  />
                ) : (
                  <span className="flex-1 font-medium">{cat.nom}</span>
                )}

                <div className="flex gap-2 shrink-0">
                  {enEdition === cat.id ? (
                    <>
                      <button
                        aria-label="Enregistrer le nom"
                        onClick={() => sauvegarderNom(cat)}
                        className="text-positive"
                      >
                        <Check size={18} />
                      </button>

                      <button
                        aria-label="Annuler la modification"
                        onClick={cancelEdit}
                        className="text-muted"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        aria-label={`Modifier ${cat.nom}`}
                        onClick={() => startEdit(cat)}
                        className="text-muted hover:text-link"
                      >
                        <Pencil size={18} />
                      </button>

                      <button
                        aria-label={`Supprimer ${cat.nom}`}
                        onClick={() => supprimer(cat)}
                        className="text-muted hover:text-negative"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {role ? (
                <div className="text-xs text-muted">
                  <p>Rôle : {role.name}</p>
                  <p>Flux : {role.flows.join(" / ")}</p>
                </div>
              ) : (
                <p className="text-xs text-negative">
                  Aucun rôle V2.1 associé : cette ancienne catégorie ne sera
                  pas proposée lors de la création d'une transaction.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
