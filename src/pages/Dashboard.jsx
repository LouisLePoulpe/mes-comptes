import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, onSnapshot, orderBy, query } from "firebase/firestore"
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

export default function Dashboard() {
  const moisCourant = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`
  const [transactions, setTransactions] = useState([])
  const [moisFiltre, setMoisFiltre] = useState(moisCourant)
  const [courbes, setCourbes] = useState({ BB: true, CMB: true, TR: true })

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("date", "asc"))
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // Liste des mois disponibles
  const moisDisponibles = []
  const vus = new Set()
  transactions.forEach(t => {
    const d = t.date?.toDate?.()
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
    const d = t.date?.toDate?.()
    if (!d) return false
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`
    return key === moisFiltre
  })

  // KPIs
  const soldes = { BB: 0, CMB: 0, TR: 0 }
  let totalEntrees = 0, totalSorties = 0
  filtrées.forEach(t => {
    const m = t.type === "Entrée" ? t.montant : -t.montant
    soldes[t.banque] = (soldes[t.banque] || 0) + m
    if (t.type === "Entrée") totalEntrees += t.montant
    else totalSorties += t.montant
  })

  // Graphique progression (toutes les transactions)
  const graphData = []
  const running = { BB: 0, CMB: 0, TR: 0 }
  transactions.forEach(t => {
    const m = t.type === "Entrée" ? t.montant : -t.montant
    running[t.banque] += m
    const d = t.date?.toDate?.()
    const date = d ? d.toLocaleDateString("fr-FR") : t.date
    graphData.push({
      date,
      BB: Math.round(running.BB),
      CMB: Math.round(running.CMB),
      TR: Math.round(running.TR),
    })
  })

  // Tendances
  let graphDataWithTrend = regression(graphData, "BB")
  graphDataWithTrend = regression(graphDataWithTrend, "CMB")
  graphDataWithTrend = regression(graphDataWithTrend, "TR")

  // Camembert
  const parCategorie = {}
  filtrées.filter(t => t.type === "Sortie").forEach(t => {
    parCategorie[t.categorie] = (parCategorie[t.categorie] || 0) + t.montant
  })
  const pieData = Object.entries(parCategorie)
    .sort((a,b) => b[1]-a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }))

  const toggleCourbe = (k) => setCourbes(c => ({ ...c, [k]: !c[k] }))

  const KPI = ({ label, value, color }) => (
    <div className="bg-gray-800 rounded-2xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value.toFixed(2)} €</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">

      {/* Header + filtre mois */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <select
          value={moisFiltre}
          onChange={e => setMoisFiltre(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Tous les mois</option>
          {moisDisponibles.map(m => (
            <option key={m} value={m}>{labelMois(m)}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KPI label="BoursoBank" value={soldes.BB} color={soldes.BB >= 0 ? "text-emerald-400" : "text-red-400"} />
        <KPI label="Consommation" value={totalSorties} color="text-red-400" />
        <KPI label="Crédit Mutuel" value={soldes.CMB} color="text-yellow-400" />
        <KPI label="Trade Republic" value={soldes.TR} color="text-yellow-400" />
      </div>

      {/* Camembert */}
      {pieData.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-sm text-gray-400 mb-3">Dépenses par catégorie</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COULEURS_PIE[i % COULEURS_PIE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }}
                  formatter={(v) => `${v} €`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 w-full">
              {pieData.map((entry, i) => {
                const pct = totalEntrees > 0 ? Math.round((entry.value / totalEntrees) * 100) : 0
                let couleur = "text-emerald-400"
                if (entry.name === "Charges" && pct > 50) couleur = "text-red-400"
                if (entry.name === "Plaisir"  && pct > 30) couleur = "text-red-400"
                if (entry.name === "Épargne"  && pct < 20) couleur = "text-red-400"
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
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-sm text-gray-400 mb-3">Progression des comptes</p>
          <div className="flex gap-2 mb-3">
            {[
              { key: "BB",  color: "bg-yellow-400" },
              { key: "CMB", color: "bg-blue-400" },
              { key: "TR",  color: "bg-orange-400" }
            ].map(({ key, color }) => (
              <button
                key={key}
                onClick={() => toggleCourbe(key)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold transition ${
                  courbes[key] ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-600"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${courbes[key] ? color : "bg-gray-600"}`} />
                {key}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={graphDataWithTrend}>
              <XAxis dataKey="date" hide />
              <YAxis width={55} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }} />
              {courbes.BB  && <Line type="monotone" dataKey="BB"  stroke="#facc15" dot={false} strokeWidth={2} />}
              {courbes.CMB && <Line type="monotone" dataKey="CMB" stroke="#60a5fa" dot={false} strokeWidth={2} />}
              {courbes.TR  && <Line type="monotone" dataKey="TR"  stroke="#f97316" dot={false} strokeWidth={2} />}
              {courbes.BB  && <Line type="monotone" dataKey="BB_trend"  stroke="#facc15" dot={false} strokeWidth={1} strokeDasharray="5 5" />}
              {courbes.CMB && <Line type="monotone" dataKey="CMB_trend" stroke="#60a5fa" dot={false} strokeWidth={1} strokeDasharray="5 5" />}
              {courbes.TR  && <Line type="monotone" dataKey="TR_trend"  stroke="#f97316" dot={false} strokeWidth={1} strokeDasharray="5 5" />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  )
}