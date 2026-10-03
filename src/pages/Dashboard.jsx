import { budgetSummary } from '../domain/budget'
import { trend, orderedCards } from '../domain/trend'
import { accountMovements } from "../domain/movements"
import { useState } from "react"
import { useData } from "../data/context"
import Info from "../components/Info"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts"

  const KPI = ({ label, value, color, style }) => (
    <div className="bg-card rounded-2xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`} style={style}>{value.toFixed(2)} €</p>
    </div>
  )


export default function Dashboard() {
  const { transactions, accounts, categories, preferences } = useData()
  const moisCourant = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`
  const [moisFiltre, setMoisFiltre] = useState(moisCourant)
  const [courbes, setCourbes] = useState({})


  // Liste des mois disponibles
  const moisDisponibles = []
  const vus = new Set()
  transactions.forEach(t => {
    const d = new Date(t.date)
    if (!d) return
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`
    if (!vus.has(key)) { vus.add(key); moisDisponibles.push(key) }
  })
  if (!vus.has(moisCourant)) moisDisponibles.push(moisCourant)
  moisDisponibles.sort().reverse()

  const labelMois = (key) => {
    const [y, m] = key.split("-")
    return new Date(y, m-1).toLocaleDateString("fr-FR", { month:"long", year:"numeric" })
  }

  // Filtrage par mois
  const filtrées = moisFiltre === "all" ? transactions : transactions.filter(t => {
    const d = new Date(t.date)
    if (!d) return false
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`
    return key === moisFiltre
  })

  // KPIs
  const soldes = Object.fromEntries(accounts.map(a => [a.id, 0]))
  let totalSorties = 0
  filtrées.forEach(t => {
    for (const [id, amount] of accountMovements(t)) soldes[id] = (soldes[id] || 0) + amount
    if (t.type === "Sortie") totalSorties += t.montant
  })

  // Graphique progression
  const graphData = []
  const running = Object.fromEntries(accounts.map(a => [a.id, 0]))
  transactions.forEach(t => {
    for (const [id, amount] of accountMovements(t)) running[id] = (running[id] || 0) + amount
    const date = new Date(t.date).toLocaleDateString("fr-FR")
    graphData.push({
      date, timestamp: Date.parse(t.date),
      ...Object.fromEntries(Object.entries(running).map(([id, value]) => [id, value])),
    })
  })

  // One end-of-day point per day, over the entire history.
  let graphDataWithTrend = [...new Map(graphData.map(row=>[row.date,row])).values()]
  const trends = {}
  for (const account of accounts) { const result = trend(graphDataWithTrend,account.id); graphDataWithTrend = result.data; trends[account.id] = result }
  const budget = budgetSummary(filtrées, categories)
  const budgetColors = preferences.budgetColors || {}
  budget.groups.forEach(group => { if (/^#[0-9a-f]{6}$/i.test(budgetColors[group.id] || '')) group.color = budgetColors[group.id] })
  const pieData = budget.groups.filter(group=>group.value > 0)
  const money = value => value.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'

  const toggleCourbe = (k) => setCourbes(c => ({ ...c, [k]: c[k] === false }))


  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">

      {/* Header + filtre mois */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <select
          value={moisFiltre}
          onChange={e => setMoisFiltre(e.target.value)}
          className="bg-card border border-line rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Tous les mois</option>
          {moisDisponibles.map(m => (
            <option key={m} value={m}>{labelMois(m)}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {orderedCards(accounts, preferences.cardOrder).map(id => id === 'consumption' ? <KPI key={id} label="Consommation" value={totalSorties} color="text-negative" /> : <KPI key={id} label={accounts.find(a=>a.id===id).name} value={soldes[id] || 0} color="" style={{color: accounts.find(a=>a.id===id).color}} />)}
      </div>
      <section aria-label="Budget Charges Épargne Plaisirs" className="bg-card rounded-2xl p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2">Charges, Épargne et Plaisirs <Info title="Répartition du budget"><p>Le camembert répartit les montants positifs de la période. Les pourcentages de la légende sont calculés sur les revenus : {money(budget.income)}. Sans revenus, ils ne sont pas calculables.</p><p>Les objectifs sont : épargne supérieure à 20 %, plaisirs inférieurs à 30 % et charges inférieures à 50 %. À la limite exacte, l’objectif n’est pas respecté. Vert signifie respecté, rouge non respecté.</p><p>Les retraits diminuent l’épargne ; un montant négatif reste visible dans la légende. Le classement et les couleurs se modifient dans Paramètres.</p></Info></h3>
        {pieData.length > 0 ? <ResponsiveContainer width="100%" height={210}><PieChart><Pie isAnimationActive={false} data={pieData} nameKey="name" dataKey="value" innerRadius={58} outerRadius={90} paddingAngle={3}>{pieData.map(group=><Cell key={group.id} fill={group.color} />)}</Pie><Tooltip contentStyle={{backgroundColor:'var(--card)',color:'var(--foreground)',borderRadius:12}} formatter={money} /></PieChart></ResponsiveContainer> : <p className="text-muted py-8 text-center">Aucune sortie classée sur cette période.</p>}
        <div className="space-y-3">{budget.groups.map(group=><div key={group.id} data-testid={`budget-${group.id}`} className={`flex justify-between gap-3 ${group.ok === null ? 'text-muted' : group.ok ? 'text-positive' : 'text-negative'}`}>
          <span><span className="inline-block w-3 h-3 rounded-full mr-2" style={{backgroundColor:group.color}} />{group.name}</span>
          <span className="text-right font-semibold">{group.percent === null ? '—' : `${group.percent.toLocaleString('fr-FR',{maximumFractionDigits:1})} %`} ({money(group.value)})</span>
        </div>)}</div>
        {budget.unclassified > 0 && <p className="text-sm text-muted mt-3">Sorties à classer : {money(budget.unclassified)}. Elles ne figurent pas dans les trois parts.</p>}
      </section>

      {/* Graphique progression */}
      {graphDataWithTrend.length > 0 && (
        <div className="bg-card rounded-2xl p-4">
          <p className="text-sm text-muted mb-3 flex items-center gap-2">Progression des comptes <Info title="Tendance"><p>Les valeurs affichées donnent la valeur de la droite à la dernière date et sa variation moyenne par mois (30,44 jours). La tendance est calculée sur tout l’historique. Elle ne constitue pas une prévision.</p></Info></p>
          <div className="flex flex-wrap gap-2 mb-3">
            {accounts.map(({ id: key, name, color }) => (
              <button
                key={key}
                onClick={() => toggleCourbe(key)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold transition ${
                  courbes[key] !== false ? "bg-field text-foreground" : "bg-panel text-muted"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {name}
              </button>
            ))}
          </div>
          {preferences.showTrendValues && <div className="space-y-2 mb-3" aria-label="Valeurs de tendance">{accounts.filter(a=>courbes[a.id] !== false).map(a=><p key={a.id} className="text-sm">{a.name} : {trends[a.id]?.last == null ? '—' : `${money(trends[a.id].last)} · ${money(trends[a.id].monthly)}/mois`}</p>)}</div>}
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={graphDataWithTrend}>
              <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} hide />
              <YAxis width={55} tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip labelFormatter={value => new Date(value).toLocaleDateString("fr-FR")} formatter={value => money(value)} contentStyle={{ backgroundColor: "var(--card)", color: "var(--foreground)", border: "none", borderRadius: "8px" }} />
              {accounts.filter(a => courbes[a.id] !== false).map(a => <Line isAnimationActive={false} key={a.id} name={a.name} type="monotone" dataKey={a.id} stroke={a.color} dot={false} strokeWidth={2} />)}
              {accounts.filter(a => courbes[a.id] !== false).map(a => <Line isAnimationActive={false} key={`${a.id}_trend`} name={`${a.name} (tendance)`} type="monotone" dataKey={`${a.id}_trend`} stroke={a.color} dot={false} strokeWidth={1} strokeDasharray="5 5" />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  )
}
