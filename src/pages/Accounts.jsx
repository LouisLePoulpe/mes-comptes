import { useState } from 'react'
import {
  addDoc,
  deleteDoc,
  updateDoc,
} from '../data/offline'
import { useData } from '../data/context'
import {
  userCollection,
  userDoc,
} from '../data/references'
import { encrypt } from '../crypto'
import {
  calculateInitialAmount,
} from '../domain/initialBalances'
import Info from '../components/Info'
import ColorPalette from '../components/ColorPalette'
import {
  Pencil,
  Trash2,
  X,
} from 'lucide-react'

export default function Accounts({
  cryptoKey,
}) {
  const {
    uid,
    accounts,
    initialBalances,
  } = useData()

  /*
   * Comptes
   */
  const [name, setName] =
    useState('')

  const [color, setColor] =
    useState('#3e9950')

  const [editing, setEditing] =
    useState(null)

  /*
   * Montants initiaux
   */
  const [
    initialEditing,
    setInitialEditing,
  ] = useState(null)

  const [
    initialAccount,
    setInitialAccount,
  ] = useState('')

  const [
    initialLabel,
    setInitialLabel,
  ] = useState('')

  const [
    initialAmount,
    setInitialAmount,
  ] = useState('')

  const [
    initialDate,
    setInitialDate,
  ] = useState(
    new Date()
      .toISOString()
      .split('T')[0]
  )

  const [error, setError] =
    useState('')

  const [busy, setBusy] =
    useState(false)

  const selectedInitialAccount =
    initialAccount ||
    accounts[0]?.id ||
    ''

  async function saveAccount(event) {
    event.preventDefault()

    if (
      !name.trim() ||
      busy
    ) {
      return
    }

    setBusy(true)
    setError('')

    try {
      const encrypted =
        await encrypt(
          {
            name: name.trim(),
            color,
          },
          cryptoKey
        )

      if (editing) {
        await updateDoc(
          userDoc(
            uid,
            'accounts',
            editing
          ),
          encrypted
        )
      } else {
        await addDoc(
          userCollection(
            uid,
            'accounts'
          ),
          encrypted
        )
      }

      setName('')
      setEditing(null)
    } catch {
      setError(
        'Enregistrement du compte impossible.'
      )
    } finally {
      setBusy(false)
    }
  }

  function resetInitialForm() {
    setInitialEditing(null)
    setInitialAccount('')
    setInitialLabel('')
    setInitialAmount('')
    setInitialDate(
      new Date()
        .toISOString()
        .split('T')[0]
    )
  }

  function editInitial(row) {
    setInitialEditing(row.id)
    setInitialAccount(row.accountId)
    setInitialLabel(row.label)
    setInitialAmount(
      String(row.amount)
    )
    setInitialDate(
      row.date?.split('T')[0] ||
      row.date
    )
    setError('')
  }

  async function saveInitial(event) {
    event.preventDefault()

    if (busy) return

    const accountId =
      selectedInitialAccount

    if (
      !accounts.some(
        account =>
          account.id === accountId
      )
    ) {
      return setError(
        'Choisis un compte.'
      )
    }

    if (!initialLabel.trim()) {
      return setError(
        'Donne un nom au montant initial.'
      )
    }

    let amount

    try {
      amount =
        calculateInitialAmount(
          initialAmount
        )
    } catch (cause) {
      return setError(
        cause.message
      )
    }

    if (
      !initialDate ||
      !Number.isFinite(
        Date.parse(initialDate)
      )
    ) {
      return setError(
        'Choisis une date valide.'
      )
    }

    setBusy(true)
    setError('')

    try {
      const encrypted =
        await encrypt(
          {
            accountId,
            label:
              initialLabel.trim(),
            amount,
            date:
              new Date(
                initialDate
              ).toISOString(),
          },
          cryptoKey
        )

      if (initialEditing) {
        await updateDoc(
          userDoc(
            uid,
            'initialBalances',
            initialEditing
          ),
          encrypted
        )
      } else {
        await addDoc(
          userCollection(
            uid,
            'initialBalances'
          ),
          encrypted
        )
      }

      resetInitialForm()
    } catch {
      setError(
        'Enregistrement du montant initial impossible.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function removeInitial(row) {
    if (
      !confirm(
        `Supprimer « ${row.label} » ?`
      )
    ) {
      return
    }

    setBusy(true)
    setError('')

    try {
      await deleteDoc(
        userDoc(
          uid,
          'initialBalances',
          row.id
        )
      )

      if (
        initialEditing === row.id
      ) {
        resetInitialForm()
      }
    } catch {
      setError(
        'Suppression du montant initial impossible.'
      )
    } finally {
      setBusy(false)
    }
  }

  const accountName = id =>
    accounts.find(
      account =>
        account.id === id
    )?.name || id

  const money = value =>
    Number(value).toLocaleString(
      'fr-FR',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ) + ' €'

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h2 className="text-2xl font-bold">
        Mes comptes

        <Info title="Comptes">
          <p>
            Les noms et couleurs
            peuvent changer sans
            modifier l'historique.
          </p>

          <p>
            Les montants initiaux
            servent uniquement à
            définir la valeur de
            départ d'un compte.
            Ils ne sont jamais
            comptés comme revenus,
            dépenses ou épargne.
          </p>
        </Info>
      </h2>

      {error && (
        <p
          role="alert"
          className="text-negative"
        >
          {error}
        </p>
      )}

      <section className="bg-card rounded-xl p-4 space-y-3">
        <h3 className="font-semibold">
          Comptes
        </h3>

        <form
          onSubmit={saveAccount}
          className="flex flex-wrap gap-2"
        >
          <input
            aria-label="Nom du compte"
            required
            maxLength={100}
            value={name}
            onChange={event =>
              setName(
                event.target.value
              )
            }
            className="bg-field rounded p-2 flex-1"
            placeholder="Nom du compte"
          />

          <ColorPalette
            label="Palette du compte"
            value={color}
            onChange={setColor}
            disabled={busy}
          />

          <input
            aria-label="Couleur du compte"
            type="color"
            value={color}
            onChange={event =>
              setColor(
                event.target.value
              )
            }
          />

          <button
            disabled={busy}
            className="bg-emerald-600 text-white rounded p-2"
          >
            {editing
              ? 'Enregistrer'
              : 'Ajouter'}
          </button>

          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setName('')
              }}
            >
              Annuler
            </button>
          )}
        </form>

        <div className="space-y-2">
          {accounts.map(
            account => (
              <div
                key={account.id}
                className="bg-field p-3 rounded flex justify-between gap-3"
              >
                <span
                  style={{
                    color:
                      account.color,
                  }}
                >
                  {account.name}
                </span>

                <button
                  disabled={busy}
                  onClick={() => {
                    setEditing(
                      account.id
                    )
                    setName(
                      account.name
                    )
                    setColor(
                      account.color
                    )
                  }}
                >
                  Modifier
                </button>
              </div>
            )
          )}
        </div>

        {!accounts.length && (
          <p className="text-muted">
            Ajoute ton premier
            compte pour saisir des
            transactions.
          </p>
        )}
      </section>

      <section className="bg-card rounded-xl p-4 space-y-4">
        <div>
          <h3 className="font-semibold">
            Montants initiaux
          </h3>

          <p className="text-sm text-muted">
            Tu peux en ajouter
            plusieurs sur un même
            compte, avec des noms et
            des dates différents.
          </p>
        </div>

        {accounts.length > 0 && (
          <form
            onSubmit={saveInitial}
            className="space-y-3"
          >
            <label className="block">
              <span className="text-sm text-muted">
                Compte
              </span>

              <select
                aria-label="Compte du montant initial"
                value={
                  selectedInitialAccount
                }
                onChange={event =>
                  setInitialAccount(
                    event.target.value
                  )
                }
                className="block w-full mt-1 bg-field border border-line rounded-xl p-3"
              >
                {accounts.map(
                  account => (
                    <option
                      key={
                        account.id
                      }
                      value={
                        account.id
                      }
                    >
                      {account.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-muted">
                Nom
              </span>

              <input
                aria-label="Nom du montant initial"
                maxLength={100}
                required
                value={initialLabel}
                onChange={event =>
                  setInitialLabel(
                    event.target.value
                  )
                }
                placeholder="Ex : Livret A"
                className="block w-full mt-1 bg-field border border-line rounded-xl p-3"
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">
                Montant (€)
              </span>

              <input
                aria-label="Montant initial"
                required
                value={initialAmount}
                onChange={event =>
                  setInitialAmount(
                    event.target.value
                  )
                }
                placeholder="Ex : 22950 ou -250"
                inputMode="decimal"
                className="block w-full mt-1 bg-field border border-line rounded-xl p-3"
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">
                Date
              </span>

              <input
                aria-label="Date du montant initial"
                type="date"
                required
                value={initialDate}
                onChange={event =>
                  setInitialDate(
                    event.target.value
                  )
                }
                className="block w-full mt-1 bg-field border border-line rounded-xl p-3"
              />
            </label>

            <div className="flex gap-2">
              <button
                disabled={busy}
                className="flex-1 bg-emerald-600 text-white rounded-xl p-3"
              >
                {initialEditing
                  ? 'Enregistrer'
                  : 'Ajouter le montant initial'}
              </button>

              {initialEditing && (
                <button
                  type="button"
                  onClick={
                    resetInitialForm
                  }
                  className="bg-field rounded-xl px-4"
                  aria-label="Annuler la modification du montant initial"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </form>
        )}

        <div className="space-y-2">
          {initialBalances.map(
            row => (
              <div
                key={row.id}
                className="bg-field rounded-xl p-3"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {row.label}
                    </p>

                    <p className="text-xs text-muted">
                      {accountName(
                        row.accountId
                      )}
                      {' · '}
                      {new Date(
                        row.date
                      ).toLocaleDateString(
                        'fr-FR'
                      )}
                    </p>
                  </div>

                  <p className="font-semibold">
                    {money(
                      row.amount
                    )}
                  </p>
                </div>

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    aria-label={`Modifier ${row.label}`}
                    disabled={busy}
                    onClick={() =>
                      editInitial(row)
                    }
                    className="text-muted hover:text-link"
                  >
                    <Pencil
                      size={17}
                    />
                  </button>

                  <button
                    aria-label={`Supprimer ${row.label}`}
                    disabled={busy}
                    onClick={() =>
                      removeInitial(
                        row
                      )
                    }
                    className="text-muted hover:text-negative"
                  >
                    <Trash2
                      size={17}
                    />
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {!initialBalances.length && (
          <p className="text-sm text-muted">
            Aucun montant initial.
          </p>
        )}
      </section>
    </div>
  )
}
