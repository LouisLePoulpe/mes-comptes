import AmountInput from "../components/AmountInput"
import { calculateAmount } from "../domain/amount"
import {
  FLOWS,
  assertCategoryFlow,
  isRoleAllowedForFlow,
} from "../domain/categoryRoles"
import { useState } from "react"
import { userCollection } from "../data/references"
import { useData } from "../data/context"
import { addDoc } from "../data/offline"
import { encrypt } from "../crypto"

export default function Ajouter({ cryptoKey, onSuccess }) {
  const { uid, categories, accounts } = useData()

  const [form, setForm] = useState({
    type: FLOWS.EXPENSE,
    montant: "",
    banque: accounts[0]?.id || "",
    banqueDest: "",
    categoryId: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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
      banqueDest: type === FLOWS.TRANSFER ? previous.banqueDest : "",
    }))
  }

  const categoriesCompatibles = categories.filter(category =>
    isRoleAllowedForFlow(category.roleId, form.type)
  )

  const submit = async () => {
    if (loading) return

    setError("")

    if (!accounts.some(account => account.id === form.banque)) {
      return setError("Choisis un compte.")
    }

    let montant

    try {
      montant = calculateAmount(form.montant)
    } catch (cause) {
      return setError(cause.message)
    }

    if (!form.date || !Number.isFinite(Date.parse(form.date))) {
      return setError("Choisis une date valide.")
    }

    const category = categories.find(
      current => current.id === form.categoryId
    )

    if (!category) {
      return setError("Choisis une catégorie compatible avec ce flux.")
    }

    try {
      assertCategoryFlow(category, form.type)
    } catch (cause) {
      return setError(cause.message)
    }

    if (
      form.type === FLOWS.TRANSFER &&
      (!accounts.some(account => account.id === form.banqueDest) ||
        form.banqueDest === form.banque)
    ) {
      return setError("Choisis un compte de destination différent.")
    }

    setLoading(true)

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

      await addDoc(
        userCollection(uid, "transactions"),
        await encrypt(data, cryptoKey)
      )

      onSuccess()
    } catch {
      setError(
        "Enregistrement impossible. Tes champs sont conservés, tu peux réessayer."
      )
    } finally {
      setLoading(false)
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
          : "bg-card text-muted hover:bg-field"
      }`}
    >
      {type}
    </button>
  )

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <h2 className="text-2xl font-bold">Ajouter une transaction</h2>

      {error && (
        <p role="alert" className="text-negative">
          {error}
        </p>
      )}

      {!accounts.length && (
        <p>Crée un compte avant de saisir une transaction.</p>
      )}

      <div className="flex gap-2">
        {btnType(FLOWS.INCOME)}
        {btnType(FLOWS.EXPENSE)}
        {btnType(FLOWS.TRANSFER)}
      </div>

      <AmountInput
        id="Ajouter-montant"
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
              className={`flex-1 min-w-24 py-2 rounded-xl font-semibold transition ${
                form.banque === account.id
                  ? "bg-blue-500 text-white"
                  : "bg-card text-muted hover:bg-field"
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
            htmlFor="Ajouter-destination"
            className="text-sm text-muted mb-1 block"
          >
            Compte de destination
          </label>

          <select
            id="Ajouter-destination"
            className="w-full bg-field border border-line rounded-xl p-3"
            value={form.banqueDest}
            onChange={event =>
              set("banqueDest", event.target.value)
            }
          >
            <option value="">Choisir...</option>

            {accounts
              .filter(account => account.id !== form.banque)
              .map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </div>
      )}

      <div>
        <label
          htmlFor="Ajouter-categorie"
          className="text-sm text-muted mb-1 block"
        >
          Catégorie
        </label>

        <select
          id="Ajouter-categorie"
          value={form.categoryId}
          onChange={event =>
            set("categoryId", event.target.value)
          }
          className="w-full bg-card border border-line rounded-xl px-4 py-3 text-foreground"
        >
          <option value="">Sélectionner...</option>

          {categoriesCompatibles.map(category => (
            <option key={category.id} value={category.id}>
              {category.nom}
            </option>
          ))}
        </select>

        {!categoriesCompatibles.length && (
          <p className="text-xs text-negative mt-2">
            Aucune catégorie compatible avec « {form.type} ».
            Ajoute les catégories V2.1 dans Paramètres → Catégories.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="Ajouter-description"
          className="text-sm text-muted mb-1 block"
        >
          Description
        </label>

        <input
          id="Ajouter-description"
          value={form.description}
          onChange={event =>
            set("description", event.target.value)
          }
          placeholder="Ex : Courses, salaire, ETF..."
          className="w-full bg-card border border-line rounded-xl px-4 py-3 text-foreground"
        />
      </div>

      <div>
        <label
          htmlFor="Ajouter-date"
          className="text-sm text-muted mb-1 block"
        >
          Date
        </label>

        <input
          type="date"
          id="Ajouter-date"
          value={form.date}
          onChange={event => set("date", event.target.value)}
          className="w-full bg-card border border-line rounded-xl px-4 py-3 text-foreground"
        />
      </div>

      <button
        onClick={submit}
        disabled={
          loading ||
          !accounts.length ||
          !categoriesCompatibles.length
        }
        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition text-lg mt-2"
      >
        {loading ? "Enregistrement..." : "✓ Enregistrer"}
      </button>
    </div>
  )
}
