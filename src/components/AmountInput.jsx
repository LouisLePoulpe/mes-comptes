import { calculateAmount } from '../domain/amount'
import Info from './Info'

export default function AmountInput({ id, value, onChange }) {
  let preview = ''
  try { preview = `${calculateAmount(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` }
  catch { /* Incomplete expressions are expected while typing; validate on save. */ }
  return <div>
    <label htmlFor={id} className="text-sm text-muted mb-1 flex items-center gap-2">Montant (€) <Info title="Calcul du montant"><p>Tu peux saisir une valeur ou une expression avec +, −, ×, ÷ et des parenthèses. Le résultat est arrondi au centime avant l'enregistrement.</p></Info></label>
    <input id={id} type="text" inputMode="text" autoComplete="off" maxLength={200}
      value={value} onChange={event => onChange(event.target.value)}
      aria-describedby={`${id}-help ${id}-result`} placeholder="Ex. (12,50 + 7,50) / 2"
      className="w-full bg-card border border-line rounded-xl px-4 py-3 text-foreground text-xl focus:outline-none focus:border-emerald-500" />
    <span id={`${id}-help`} className="sr-only">Une valeur ou une expression avec opérations et parenthèses est acceptée.</span>
    <p id={`${id}-result`} aria-live="polite" className="text-sm text-positive min-h-6">{preview && `Résultat : ${preview}`}</p>
  </div>
}
