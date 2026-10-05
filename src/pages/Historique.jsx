import AmountInput from "../components/AmountInput"
import { calculateAmount } from "../domain/amount"
import {
  FLOWS,
  assertCategoryFlow,
  isRoleAllowedForFlow,
} from "../domain/categoryRoles"
import { useState } from "react"
import { userDoc } from "../data/references"
import { useData } from "../data/context"
import { deleteDoc, updateDoc } from "../data/offline"
import { encrypt } from "../crypto"
import { Trash2, Pencil, X, Filter } from "lucide-react"
import { matchesDescription } from "../domain/search"
import SyncStatus from '../components/SyncStatus'

function ModalEdition({ transaction, categories, cryptoKey, onClose, onSave }) {
  const { uid, accounts } = useData()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    type: transaction.type,
    montant: transaction.montant,
    banque: transaction.banque,
    banqueDest: transaction.banqueDest || "",
    categoryId: transaction.categoryId || "",
    description: transaction.description || "",
    date: transaction.date?.split("T")[0] ?? transaction.date,
  })

  const set = (key, value) =>
    setForm(previous => ({
      ...previous,
      [key]: value,
    }))

  const setType = type => {
    setForm(previous => ({
      ...previous,
      type,
      categoryId: "",
      banqueDest:
        type === FLOWS.TRANSFER
          ? previous.banqueDest
          : "",
    }))
  }

  const categoriesCompatibles = categories.filter(category =>
    isRoleAllowedForFlow(category.roleId, form.type)
  )

  const sauvegarder = async () => {
    if (saving) return

    setError("")

    let montant

    try {
      montant = calculateAmount(form.montant)
    } catch (cause) {
      return setError(cause.message)
    }

    if (
      !accounts.some(account => account.id === form.banque) ||
      !Number.isFinite(Date.parse(form.date))
    ) {
      return setError("Compte, montant et date valides requis.")
    }

    const category = categories.find(
      current => current.id === form.categoryId
    )

    if (!category) {
      return setError(
        "Choisis une catégorie compatible avec ce flux."
      )
    }

    try {
      assertCategoryFlow(category, form.type)
    } catch (cause) {
      return setError(cause.message)
    }

    if (
      form.type === FLOWS.TRANSFER &&
      (
        !accounts.some(account => account.id === form.banqueDest) ||
        form.banqueDest === form.banque
      )
    ) {
      return setError(
        "Choisis un compte de destination différent."
      )
    }

    setSaving(true)

    try {
      const data = {
        type: form.type,
        montant,
        banque: form.banque,
        ...(form.type === FLOWS.TRANSFER
          ? { banqueDest: form.banqueDest }
          : {}),
        categoryId: category.id,
        categorie: category.nom,
        description: form.description,
        date: new Date(form.date).toISOString(),
      }

      await updateDoc(
        userDoc(uid, "transactions", transaction.id),
        await encrypt(data, cryptoKey)
      )

      onSave()
    } catch {
      setError(
        "Modification impossible. Tes champs sont conservés, tu peux réessayer."
      )
    } finally {
      setSaving(false)
    }
  }

  const btnType = type => (
    <button
      key={type}
      onClick={() => setType(type)}
      className={`flex-1 py-2 rounded-xl font-semibold transition ${
        form.type === type
          ? type === FLOWS.INCOME
            ? "bg-emerald-500 text-white"
            : type === FLOWS.EXPENSE
              ? "bg-red-500 text-white"
              : "bg-blue-500 text-white"
          : "bg-field text-muted hover:bg-hover"
      }`}
    >
      {type}
    </button>
  )

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Modifier la transaction"
        className="bg-panel rounded-2xl w-full max-w-md flex flex-col gap-4 p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">
            Modifier la transaction
          </h3>

          <button
            aria-label="Fermer la modification"
            onClick={onClose}
            className="text-muted hover:text-foreground"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex gap-2">
          {btnType(FLOWS.INCOME)}
          {btnType(FLOWS.EXPENSE)}
          {btnType(FLOWS.TRANSFER)}
        </div>

        <AmountInput
          id="Historique-montant"
          value={form.montant}
          onChange={value => set("montant", value)}
        />

        <div>
          <label className="text-sm text-muted mb-1 block">
            {form.type === FLOWS.TRANSFER
              ? "Compte source"
              : "Compte"}
          </label>

          <div className="flex flex-wrap gap-2">
            {accounts.map(account => (
              <button
                key={account.id}
                onClick={() => set("banque", account.id)}
                className={`flex-1 min-w-24 py-2 rounded-xl font-semibold ${
                  form.banque === account.id
                    ? "bg-blue-500 text-white"
                    : "bg-card text-muted"
                }`}
              >
                {account.name}
              </button>
            ))}
          </div>
        </div>

        {form.type === FLOWS.TRANSFER && (
          <div>
            <label
              htmlFor="Historique-destination"
              className="text-sm text-muted mb-1 block"
            >
              Compte de destination
            </label>

            <select
              id="Historique-destination"
              value={form.banqueDest}
              onChange={event =>
                set("banqueDest", event.target.value)
              }
              className="w-full bg-field border border-line rounded-xl p-3"
            >
              <option value="">Choisir...</option>

              {accounts
                .filter(account => account.id !== form.banque)
                .map(account => (
                  <option
                    key={account.id}
                    value={account.id}
                  >
                    {account.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          <label
            htmlFor="Historique-categorie"
            className="text-sm text-muted mb-1 block"
          >
            Catégorie
          </label>

          <select
            id="Historique-categorie"
            value={form.categoryId}
            onChange={event =>
              set("categoryId", event.target.value)
            }
            className="w-full bg-card border border-line rounded-xl px-4 py-3 text-foreground"
          >
            <option value="">Sélectionner...</option>

            {categoriesCompatibles.map(category => (
              <option
                key={category.id}
                value={category.id}
              >
                {category.nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="Historique-description"
            className="text-sm text-muted mb-1 block"
          >
            Description
          </label>

          <input
            id="Historique-description"
            value={form.description}
            onChange={event =>
              set("description", event.target.value)
            }
            className="w-full bg-card border border-line rounded-xl px-4 py-3 text-foreground"
          />
        </div>

        <div>
          <label
            htmlFor="Historique-date"
            className="text-sm text-muted mb-1 block"
          >
            Date
          </label>

          <input
            type="date"
            id="Historique-date"
            value={form.date}
            onChange={event =>
              set("date", event.target.value)
            }
            className="w-full bg-card border border-line rounded-xl px-4 py-3 text-foreground"
          />
        </div>

        {error && (
          <p role="alert" className="text-negative">
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-field text-foreground font-semibold py-3 rounded-xl"
          >
            Annuler
          </button>

          <button
            disabled={saving}
            onClick={sauvegarder}
            className="flex-1 bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl"
          >
            {saving ? "Enregistrement..." : "✓ Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  )
}

const MOIS_NOMS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

export default function Historique({ cryptoKey }) {
  const { uid, transactions, categories, accounts, accountName } = useData()
  const [search, setSearch] = useState("")
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

  const anneesDisponibles = [...new Set(transactions.map(t => new Date(t.date).getFullYear()).filter(Boolean))].sort().reverse()

  const moisDisponibles = [...new Set(transactions
    .filter(t => !filtres.annee || new Date(t.date).getFullYear() === parseInt(filtres.annee))
    .map(t => new Date(t.date).getMonth() + 1)
    .filter(Boolean)
  )].sort((a,b) => b - a)

  const filtrées = [...transactions].reverse().filter(t => {
    if (!matchesDescription(t, search)) return false
    if (filtres.type && t.type !== filtres.type) return false
    if (filtres.banque && t.banque !== filtres.banque && !(t.type === "Transfert" && t.banqueDest === filtres.banque)) return false
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
          <div className="relative bg-panel rounded-t-3xl p-6 flex flex-col gap-4 z-10 max-h-[85vh] overflow-y-auto pb-24">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">Filtres</h3>
              <button onClick={() => setFiltres({ banque: "", categorie: "", type: "", mois: "", annee: "" })}
                className="text-sm text-positive">
                Réinitialiser
              </button>
            </div>

            <div>
              <label className="text-xs text-muted mb-2 block">Type</label>
              <div className="flex gap-2">
                {["Entrée", "Sortie", "Transfert"].map(t => (
                  <button key={t} onClick={() => setF("type", filtres.type === t ? "" : t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                      filtres.type === t ? "bg-emerald-500 text-white" : "bg-card text-muted"
                    }`}>{t}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-2 block">Banque</label>
              <div className="flex gap-2">
                {accounts.map(({ id: b, name }) => (
                  <button key={b} onClick={() => setF("banque", filtres.banque === b ? "" : b)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                      filtres.banque === b ? "bg-blue-500 text-white" : "bg-card text-muted"
                    }`}>{name}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-2 block">Catégorie</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categoriesListe.map(c => (
                  <button key={c} onClick={() => setF("categorie", filtres.categorie === c ? "" : c)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
                      filtres.categorie === c ? "bg-purple-500 text-white" : "bg-card text-muted"
                    }`}>{c}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted mb-2 block">Année</label>
                <select value={filtres.annee} onChange={e => setF("annee", e.target.value)}
                  className="w-full bg-card border border-line rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none">
                  <option value="">Toutes</option>
                  {anneesDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted mb-2 block">Mois</label>
                <select value={filtres.mois} onChange={e => setF("mois", e.target.value)}
                  className="w-full bg-card border border-line rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none">
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

      {error && <p role="alert" className="text-negative">{error}</p>}
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><h2 className="text-2xl font-bold mb-0">Historique</h2><SyncStatus /></div>
      </div>

      <div className="mb-4">
        <label htmlFor="history-search" className="text-sm text-muted block mb-1">Rechercher par nom</label>
        <input id="history-search" type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Ex. courses, salaire…" className="w-full bg-card border border-line rounded-xl px-4 py-3" />
      </div>
      {/* Bouton Filtrer */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted">
          {filtrées.length} transaction{filtrées.length > 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setDrawerOpen(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            nbFiltresActifs > 0 ? "bg-emerald-500 text-white" : "bg-card text-muted"
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
          <p className="text-muted text-center py-12">Aucune transaction</p>
        )}
        {filtrées.map(t => (
          <div key={t.id} className="bg-card rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className={`text-lg font-bold shrink-0 ${t.type === "Transfert" ? "text-link" : t.type === "Entrée" ? "text-positive" : "text-negative"}`}>
                {t.type === "Transfert" ? "↔ " : t.type === "Entrée" ? "+" : "-"}{t.montant}€
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.description || "—"}</p>
                <p className="text-xs text-muted">
                  {accountName(t.banque)}{t.type === "Transfert" ? ` → ${accountName(t.banqueDest)}` : ""} · {t.categorie} · {new Date(t.date).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button aria-label={`Modifier ${t.description || "la transaction"}`} onClick={() => setEnEdition(t)} className="text-muted hover:text-link transition">
                <Pencil size={16} />
              </button>
              <button aria-label={`Supprimer ${t.description || "la transaction"}`} onClick={() => supprimer(t.id)} className="text-muted hover:text-negative transition">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
