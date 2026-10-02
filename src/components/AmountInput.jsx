import { calculateAmount } from '../domain/amount'

export default function AmountInput({ id, value, onChange }) {
  let preview = ''
  try { preview = `${calculateAmount(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` }
  catch { /* Incomplete expressions are expected while typing; validate on save. */ }
  return <div>
    <label htmlFor={id} className="text-sm text-muted mb-1 block">Montant (€)</label>
    <input id={id} type="text" inputMode="text" autoComplete="off" maxLength={200}
      value={value} onChange={event => onChange(event.target.value)}
      aria-describedby={`${id}-help ${id}-result`} placeholder="Ex. (12,50 + 7,50) / 2"
      className="w-full bg-card border border-line rounded-xl px-4 py-3 text-foreground text-xl focus:outline-none focus:border-emerald-500" />
    <p id={`${id}-help`} className="text-xs text-muted mt-2">Calculs acceptés : +, −, ×, ÷ et parenthèses. Résultat arrondi au centime.</p>
    <p id={`${id}-result`} aria-live="polite" className="text-sm text-positive min-h-6">{preview && `Résultat : ${preview}`}</p>
  </div>
}
