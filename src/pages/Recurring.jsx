import { useState } from 'react'
import AmountInput from '../components/AmountInput'
import Info from '../components/Info'
import { calculateAmount } from '../domain/amount'
import {
  FLOWS,
  isRoleAllowedForFlow,
} from '../domain/categoryRoles'
import {
  RECURRENCE_UNITS,
  validateRecurringRule,
} from '../domain/recurring'
import { useData } from '../data/context'
import {
  addDoc,
  deleteDoc,
  updateDoc,
} from '../data/offline'
import {
  userCollection,
  userDoc,
} from '../data/references'
import { encrypt } from '../crypto'
import {
  Pause,
  Play,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'


function localDay() {
  const now = new Date()

  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(2, '0'),
    String(
      now.getDate()
    ).padStart(2, '0'),
  ].join('-')
}


const EMPTY_FORM = accounts => ({
  type: FLOWS.EXPENSE,
  montant: '',
  banque:
    accounts[0]?.id || '',
  banqueDest: '',
  categoryId: '',
  description: '',
  startDate: localDay(),
  endDate: '',
  interval: 1,
  unit:
    RECURRENCE_UNITS.MONTH,
})


function recurrenceLabel(rule) {
  const interval =
    Number(rule.interval || 1)

  const labels = {
    [RECURRENCE_UNITS.DAY]:
      ['jour', 'jours'],

    [RECURRENCE_UNITS.WEEK]:
      ['semaine', 'semaines'],

    [RECURRENCE_UNITS.MONTH]:
      ['mois', 'mois'],

    [RECURRENCE_UNITS.YEAR]:
      ['an', 'ans'],
  }

  const [singular, plural] =
    labels[rule.unit] ||
    ['période', 'périodes']

  if (interval === 1) {
    if (
      rule.unit ===
      RECURRENCE_UNITS.MONTH
    ) {
      return 'Tous les mois'
    }

    if (
      rule.unit ===
      RECURRENCE_UNITS.WEEK
    ) {
      return 'Toutes les semaines'
    }

    return `Tous les ${singular}`
  }

  return (
    `Tous les ${interval} ${plural}`
  )
}


export default function Recurring({
  cryptoKey,
}) {
  const {
    uid,
    accounts,
    categories,
    recurringRules,
  } = useData()

  const [form, setForm] =
    useState(
      EMPTY_FORM(accounts)
    )

  const [editing, setEditing] =
    useState(null)

  const [busy, setBusy] =
    useState(false)

  const [error, setError] =
    useState('')


  const set = (key, value) =>
    setForm(previous => ({
      ...previous,
      [key]: value,
    }))


  const categoriesCompatibles =
    categories.filter(
      category =>
        isRoleAllowedForFlow(
          category.roleId,
          form.type
        )
    )


  function reset() {
    setEditing(null)

    setForm(
      EMPTY_FORM(accounts)
    )

    setError('')
  }


  function setType(type) {
    setForm(previous => ({
      ...previous,
      type,
      categoryId: '',
      banqueDest:
        type === FLOWS.TRANSFER
          ? previous.banqueDest
          : '',
    }))
  }


  function startEdit(rule) {
    setEditing(rule.id)

    setForm({
      type: rule.type,
      montant:
        String(rule.montant),
      banque:
        rule.banque,
      banqueDest:
        rule.banqueDest || '',
      categoryId:
        rule.categoryId,
      description:
        rule.description || '',
      startDate:
        String(
          rule.startDate
        ).slice(0, 10),
      endDate:
        rule.endDate
          ? String(
              rule.endDate
            ).slice(0, 10)
          : '',
      interval:
        Number(
          rule.interval || 1
        ),
      unit:
        rule.unit,
    })

    setError('')
  }


  async function save(event) {
    event.preventDefault()

    if (busy) return

    setError('')

    let montant

    try {
      montant =
        calculateAmount(
          form.montant
        )
    } catch (cause) {
      return setError(
        cause.message
      )
    }

    const previous =
      editing
        ? recurringRules.find(
            rule =>
              rule.id === editing
          )
        : null

    const rule = {
      type:
        form.type,

      montant,

      banque:
        form.banque,

      ...(form.type ===
        FLOWS.TRANSFER
        ? {
            banqueDest:
              form.banqueDest,
          }
        : {}),

      categoryId:
        form.categoryId,

      description:
        form.description.trim(),

      startDate:
        form.startDate,

      ...(form.endDate
        ? {
            endDate:
              form.endDate,
          }
        : {}),

      interval:
        Number(
          form.interval
        ),

      unit:
        form.unit,

      effectiveFrom:
        editing
          ? localDay()
          : form.startDate,

      active:
        previous
          ? previous.active !== false
          : true,
    }

    try {
      validateRecurringRule(
        rule,
        categories,
        accounts
      )
    } catch (cause) {
      return setError(
        cause.message
      )
    }

    setBusy(true)

    try {
      const encrypted =
        await encrypt(
          rule,
          cryptoKey
        )

      if (editing) {
        await updateDoc(
          userDoc(
            uid,
            'recurringRules',
            editing
          ),
          encrypted
        )
      } else {
        await addDoc(
          userCollection(
            uid,
            'recurringRules'
          ),
          encrypted
        )
      }

      reset()
    } catch {
      setError(
        'Impossible d’enregistrer cette transaction périodique.'
      )
    } finally {
      setBusy(false)
    }
  }


  async function toggle(rule) {
    if (busy) return

    setBusy(true)
    setError('')

    try {
      const {
        id,
        ...data
      } = rule

      await updateDoc(
        userDoc(
          uid,
          'recurringRules',
          id
        ),
        await encrypt(
          {
            ...data,

            active:
              rule.active === false,

            ...(rule.active === false
              ? {
                  effectiveFrom:
                    localDay(),
                }
              : {}),
          },
          cryptoKey
        )
      )
    } catch {
      setError(
        'Impossible de modifier l’état de cette périodicité.'
      )
    } finally {
      setBusy(false)
    }
  }


  async function remove(rule) {
    if (
      !confirm(
        'Supprimer cette périodicité ? Les transactions déjà générées resteront dans l’historique.'
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
          'recurringRules',
          rule.id
        )
      )

      if (
        editing === rule.id
      ) {
        reset()
      }
    } catch {
      setError(
        'Suppression impossible.'
      )
    } finally {
      setBusy(false)
    }
  }


  const categoryName = id =>
    categories.find(
      category =>
        category.id === id
    )?.nom || 'Catégorie inconnue'


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


  const buttonType = type => (
    <button
      type="button"
      key={type}
      onClick={() =>
        setType(type)
      }
      className={`flex-1 py-2 rounded-xl font-semibold transition ${
        form.type === type
          ? type === FLOWS.INCOME
            ? 'bg-emerald-500 text-white'
            : type === FLOWS.EXPENSE
              ? 'bg-red-500 text-white'
              : 'bg-blue-500 text-white'
          : 'bg-field text-muted'
      }`}
    >
      {type}
    </button>
  )


  return (
    <div className="max-w-2xl mx-auto space-y-6">

      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          Transactions périodiques

          <Info title="Transactions périodiques">
            <p>
              Poulpécule crée automatiquement
              les occurrences arrivées à
              échéance lorsque l’application
              est ouverte.
            </p>

            <p>
              Les opérations générées sont de
              vraies transactions : elles
              restent dans l’historique même
              si tu mets ensuite la règle en
              pause ou si tu la supprimes.
            </p>

            <p>
              La génération fonctionne aussi
              hors ligne. La synchronisation
              vers les autres appareils se
              fera lorsque la connexion
              reviendra.
            </p>
          </Info>
        </h2>

        <p className="text-sm text-muted mt-1">
          Salaire, loyer, épargne automatique,
          abonnement…
        </p>
      </div>


      {error && (
        <p
          role="alert"
          className="text-negative"
        >
          {error}
        </p>
      )}


      <form
        onSubmit={save}
        className="bg-card rounded-2xl p-4 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">
            {editing
              ? 'Modifier la périodicité'
              : 'Nouvelle périodicité'}
          </h3>

          {editing && (
            <button
              type="button"
              onClick={reset}
              aria-label="Annuler la modification"
              className="text-muted"
            >
              <X size={19} />
            </button>
          )}
        </div>


        <div className="flex gap-2">
          {buttonType(
            FLOWS.INCOME
          )}

          {buttonType(
            FLOWS.EXPENSE
          )}

          {buttonType(
            FLOWS.TRANSFER
          )}
        </div>


        <AmountInput
          id="Periodic-montant"
          value={form.montant}
          onChange={value =>
            set(
              'montant',
              value
            )
          }
        />


        <label className="block">
          <span className="text-sm text-muted">
            {form.type ===
            FLOWS.TRANSFER
              ? 'Compte source'
              : 'Compte'}
          </span>

          <select
            aria-label="Compte périodique"
            value={form.banque}
            onChange={event =>
              set(
                'banque',
                event.target.value
              )
            }
            className="w-full mt-1 bg-field border border-line rounded-xl p-3"
          >
            <option value="">
              Choisir...
            </option>

            {accounts.map(
              account => (
                <option
                  key={account.id}
                  value={account.id}
                >
                  {account.name}
                </option>
              )
            )}
          </select>
        </label>


        {form.type ===
          FLOWS.TRANSFER && (
          <label className="block">
            <span className="text-sm text-muted">
              Compte de destination
            </span>

            <select
              aria-label="Compte de destination périodique"
              value={
                form.banqueDest
              }
              onChange={event =>
                set(
                  'banqueDest',
                  event.target.value
                )
              }
              className="w-full mt-1 bg-field border border-line rounded-xl p-3"
            >
              <option value="">
                Choisir...
              </option>

              {accounts
                .filter(
                  account =>
                    account.id !==
                    form.banque
                )
                .map(
                  account => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.name}
                    </option>
                  )
                )}
            </select>
          </label>
        )}


        <label className="block">
          <span className="text-sm text-muted">
            Catégorie
          </span>

          <select
            aria-label="Catégorie périodique"
            value={
              form.categoryId
            }
            onChange={event =>
              set(
                'categoryId',
                event.target.value
              )
            }
            className="w-full mt-1 bg-field border border-line rounded-xl p-3"
          >
            <option value="">
              Choisir...
            </option>

            {categoriesCompatibles.map(
              category => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.nom}
                </option>
              )
            )}
          </select>
        </label>


        <label className="block">
          <span className="text-sm text-muted">
            Description
          </span>

          <input
            aria-label="Description périodique"
            value={
              form.description
            }
            onChange={event =>
              set(
                'description',
                event.target.value
              )
            }
            placeholder="Ex : Loyer"
            className="w-full mt-1 bg-field border border-line rounded-xl p-3"
          />
        </label>


        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-muted">
              Première occurrence
            </span>

            <input
              aria-label="Première occurrence"
              type="date"
              required
              value={
                form.startDate
              }
              onChange={event =>
                set(
                  'startDate',
                  event.target.value
                )
              }
              className="w-full mt-1 bg-field border border-line rounded-xl p-3"
            />
          </label>


          <label className="block">
            <span className="text-sm text-muted">
              Fin facultative
            </span>

            <input
              aria-label="Fin de périodicité"
              type="date"
              value={
                form.endDate
              }
              onChange={event =>
                set(
                  'endDate',
                  event.target.value
                )
              }
              className="w-full mt-1 bg-field border border-line rounded-xl p-3"
            />
          </label>
        </div>


        <div className="grid grid-cols-[100px_1fr] gap-3">
          <label className="block">
            <span className="text-sm text-muted">
              Tous les
            </span>

            <input
              aria-label="Intervalle périodique"
              type="number"
              min="1"
              max="10000"
              required
              value={
                form.interval
              }
              onChange={event =>
                set(
                  'interval',
                  event.target.value
                )
              }
              className="w-full mt-1 bg-field border border-line rounded-xl p-3"
            />
          </label>


          <label className="block">
            <span className="text-sm text-muted">
              Unité
            </span>

            <select
              aria-label="Unité périodique"
              value={form.unit}
              onChange={event =>
                set(
                  'unit',
                  event.target.value
                )
              }
              className="w-full mt-1 bg-field border border-line rounded-xl p-3"
            >
              <option
                value={
                  RECURRENCE_UNITS.DAY
                }
              >
                Jour(s)
              </option>

              <option
                value={
                  RECURRENCE_UNITS.WEEK
                }
              >
                Semaine(s)
              </option>

              <option
                value={
                  RECURRENCE_UNITS.MONTH
                }
              >
                Mois
              </option>

              <option
                value={
                  RECURRENCE_UNITS.YEAR
                }
              >
                Année(s)
              </option>
            </select>
          </label>
        </div>


        {editing && (
          <p className="text-xs text-muted">
            Modifier la règle ne change pas
            les transactions déjà générées.
            Les prochaines occurrences
            utiliseront les nouvelles valeurs.
          </p>
        )}


        <button
          disabled={
            busy ||
            !accounts.length ||
            !categoriesCompatibles.length
          }
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl py-3 font-semibold"
        >
          {busy
            ? 'Enregistrement...'
            : editing
              ? 'Enregistrer les modifications'
              : 'Créer la périodicité'}
        </button>
      </form>


      <section className="space-y-3">
        <h3 className="font-semibold">
          Mes périodicités
        </h3>

        {!recurringRules.length && (
          <p className="text-muted">
            Aucune transaction périodique.
          </p>
        )}

        {recurringRules.map(
          rule => (
            <article
              key={rule.id}
              className={`bg-card rounded-2xl p-4 space-y-3 ${
                rule.active === false
                  ? 'opacity-65'
                  : ''
              }`}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {rule.description ||
                      categoryName(
                        rule.categoryId
                      )}
                  </p>

                  <p className="text-sm text-muted">
                    {rule.type}
                    {' · '}
                    {categoryName(
                      rule.categoryId
                    )}
                  </p>
                </div>

                <p className="font-semibold whitespace-nowrap">
                  {money(
                    rule.montant
                  )}
                </p>
              </div>


              <div className="text-sm text-muted space-y-1">
                <p>
                  {accountName(
                    rule.banque
                  )}

                  {rule.type ===
                    FLOWS.TRANSFER && (
                    <>
                      {' → '}
                      {accountName(
                        rule.banqueDest
                      )}
                    </>
                  )}
                </p>

                <p>
                  {recurrenceLabel(
                    rule
                  )}
                  {' · dès le '}
                  {new Date(
                    `${String(
                      rule.startDate
                    ).slice(
                      0,
                      10
                    )}T00:00:00`
                  ).toLocaleDateString(
                    'fr-FR'
                  )}
                </p>

                {rule.endDate && (
                  <p>
                    Jusqu’au{' '}
                    {new Date(
                      `${String(
                        rule.endDate
                      ).slice(
                        0,
                        10
                      )}T00:00:00`
                    ).toLocaleDateString(
                      'fr-FR'
                    )}
                  </p>
                )}

                <p
                  className={
                    rule.active === false
                      ? 'text-negative'
                      : 'text-positive'
                  }
                >
                  {rule.active === false
                    ? 'En pause'
                    : 'Active'}
                </p>
              </div>


              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    toggle(rule)
                  }
                  aria-label={
                    rule.active === false
                      ? `Reprendre ${rule.description || 'la périodicité'}`
                      : `Mettre en pause ${rule.description || 'la périodicité'}`
                  }
                  className="text-muted hover:text-link"
                >
                  {rule.active === false
                    ? <Play size={18} />
                    : <Pause size={18} />}
                </button>


                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    startEdit(rule)
                  }
                  aria-label={`Modifier ${rule.description || 'la périodicité'}`}
                  className="text-muted hover:text-link"
                >
                  <Pencil size={18} />
                </button>


                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    remove(rule)
                  }
                  aria-label={`Supprimer ${rule.description || 'la périodicité'}`}
                  className="text-muted hover:text-negative"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          )
        )}
      </section>
    </div>
  )
}
