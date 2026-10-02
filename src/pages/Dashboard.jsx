import { useState } from "react"
import { useData } from "../data/context"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts"

const COULEURS_PIE = ["#10b981", "#f97316", "#60a5fa", "#a78bfa", "#f43f5e", "#facc15"]

function regression(data, key) {
  const n = data.length
  if (n < 2) return data
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  data.forEach((d, i) => {
    sumX += i; sumY += d[key]; sumXY += i * d[key]; sumX2 += i * i
  })
  const a = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const b = (sumY - a * sumX) / n
  return data.map((d, i) => ({ ...d, [`${key}_trend`]: Math.round(a * i + b) }))
}

// Variation selectors are intentionally stripped alongside emoji ranges.
// eslint-disable-next-line no-misleading-character-class
const stripEmojis = (str) => str?.replace(/[\u{1F000}-\u{1FFFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|\u{FE00}-\u{FE0F}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FAFF}]/gu, "").trim() || ""

  const KPI = ({ label, value, color }) => (
    <div className="bg-card rounded-2xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value.toFixed(2)} €</p>
    </div>
  )


export default function Dashboard() {
  const { transactions, accounts } = useData()
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
    const m = t.type === "Entrée" ? t.montant : -t.montant
    soldes[t.banque] = (soldes[t.banque] || 0) + m
    if (t.type === "Sortie") totalSorties += t.montant
  })

  // Entrées de tous les comptes pour le calcul des pourcentages
  const entrees = filtrées
    .filter(t => t.type === "Entrée" )
    .reduce((sum, t) => sum + t.montant, 0)

  // Graphique progression
  const graphData = []
  const running = Object.fromEntries(accounts.map(a => [a.id, 0]))
  transactions.forEach(t => {
    const m = t.type === "Entrée" ? t.montant : -t.montant
    running[t.banque] = (running[t.banque] || 0) + m
    const date = new Date(t.date).toLocaleDateString("fr-FR")
    graphData.push({
      date,
      ...Object.fromEntries(Object.entries(running).map(([id, value]) => [id, Math.round(value)])),
    })
  })

  // Tendances
  const graphDataWithTrend = accounts.reduce((data, account) => regression(data, account.id), graphData)

  // Camembert
  // Pass 1 : accumuler uniquement les non-Retrait
  const parCategorie = {}
  filtrées
    .filter(t => t.type === "Sortie" && !t.categorie?.includes("Retrait"))
    .forEach(t => {
      parCategorie[t.categorie] = (parCategorie[t.categorie] || 0) + t.montant
    })

  // Pass 2 : soustraire les Retrait de leur catégorie cible
  filtrées
    .filter(t => t.type === "Sortie" && t.categorie?.includes("Retrait"))
    .forEach(t => {
      const motsCle = stripEmojis(t.categorie).replace(/Retrait/g, "").trim()
      const catCible = Object.keys(parCategorie).find(k => stripEmojis(k).includes(motsCle))
      if (catCible) parCategorie[catCible] -= t.montant
    })

  // Supprimer les valeurs négatives ou nulles
  Object.keys(parCategorie).forEach(k => {
    if (parCategorie[k] <= 0) delete parCategorie[k]
  })

  const pieData = Object.entries(parCategorie)
    .sort((a,b) => b[1]-a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }))

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
        {accounts.map(a => <KPI key={a.id} label={a.name} value={soldes[a.id] || 0} color={(soldes[a.id] || 0) < 0 ? "text-negative" : "text-positive"} />)}
        <KPI label="Consommation" value={totalSorties} color="text-negative" />
      </div>

      {/* Camembert */}
      {pieData.length > 0 && (
        <div className="bg-card rounded-2xl p-4">
          <p className="text-sm text-muted mb-3">Dépenses par catégorie</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie isAnimationActive={false} data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COULEURS_PIE[i % COULEURS_PIE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", color: "var(--foreground)", border: "none", borderRadius: "8px" }}
                  formatter={(v) => `${v} €`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 w-full">
              {pieData.map((entry, i) => {
                const pct = entrees > 0 ? Math.round((entry.value / entrees) * 100) : 0
                let couleur = "text-positive"
                if (entry.name.includes("Charges") && pct > 50) couleur = "text-negative"
                if (entry.name.includes("Plaisir")  && pct > 30) couleur = "text-negative"
                if (entry.name.includes("pargne")   && pct < 20) couleur = "text-negative"
                return (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COULEURS_PIE[i % COULEURS_PIE.length] }} />
                      <span className="text-sm">{entry.name}</span>
                    </div>
                    <span className={`text-sm font-semibold ${couleur}`}>
                      {pct}% ({entry.value} €)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Graphique progression */}
      {graphDataWithTrend.length > 0 && (
        <div className="bg-card rounded-2xl p-4">
          <p className="text-sm text-muted mb-3">Progression des comptes</p>
          <div className="flex gap-2 mb-3">
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
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={graphDataWithTrend}>
              <XAxis dataKey="date" hide />
              <YAxis width={55} tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "var(--card)", color: "var(--foreground)", border: "none", borderRadius: "8px" }} />
              {accounts.filter(a => courbes[a.id] !== false).map(a => <Line isAnimationActive={false} key={a.id} name={a.name} type="monotone" dataKey={a.id} stroke={a.color} dot={false} strokeWidth={2} />)}
              {accounts.filter(a => courbes[a.id] !== false).map(a => <Line isAnimationActive={false} key={`${a.id}_trend`} name={`${a.name} (tendance)`} type="monotone" dataKey={`${a.id}_trend`} stroke={a.color} dot={false} strokeWidth={1} strokeDasharray="5 5" />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  )
}