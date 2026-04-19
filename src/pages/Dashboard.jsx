import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, onSnapshot, orderBy, query } from "firebase/firestore"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"

export default function Dashboard() {
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("date", "asc"))
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // Calcul des soldes par banque
  const soldes = { BB: 0, CMB: 0, TR: 0 }
  let totalEntrees = 0, totalSorties = 0
  transactions.forEach(t => {
    const m = t.type === "Entrée" ? t.montant : -t.montant
    soldes[t.banque] = (soldes[t.banque] || 0) + m
    if (t.type === "Entrée") totalEntrees += t.montant
    else totalSorties += t.montant
  })
  const benefice = totalEntrees - totalSorties

  // Données graphique progression dans le temps
  const graphData = []
  const running = { BB: 0, CMB: 0, TR: 0 }
  transactions.forEach(t => {
    const m = t.type === "Entrée" ? t.montant : -t.montant
    running[t.banque] += m
    const date = t.date?.toDate?.().toLocaleDateString("fr-FR") ?? t.date
    graphData.push({
      date,
      BB: Math.round(running.BB),
      CMB: Math.round(running.CMB),
      TR: Math.round(running.TR),
      Total: Math.round(running.BB + running.CMB + running.TR)
    })
  })

  // Répartition par catégorie
  const parCategorie = {}
  transactions.filter(t => t.type === "Sortie").forEach(t => {
    parCategorie[t.categorie] = (parCategorie[t.categorie] || 0) + t.montant
  })

  const KPI = ({ label, value, color }) => (
    <div className="bg-gray-800 rounded-2xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value.toFixed(2)} €</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KPI label="Bénéfice total" value={benefice} color={benefice >= 0 ? "text-emerald-400" : "text-red-400"} />
        <KPI label="Consommation" value={totalSorties} color="text-red-400" />
        <KPI label="BoursoBank" value={soldes.BB} color="text-yellow-400" />
        <KPI label="Crédit Mutuel" value={soldes.CMB} color="text-yellow-400" />
        <KPI label="Trade Republic" value={soldes.TR} color="text-yellow-400" />
        <KPI label="Total" value={soldes.BB + soldes.CMB + soldes.TR} color="text-white" />
      </div>

      {/* Graphique progression */}
      {graphData.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-sm text-gray-400 mb-3">Progression des comptes</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={graphData}>
              <XAxis dataKey="date" hide />
              <YAxis width={50} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }} />
              <Legend />
              <Line type="monotone" dataKey="BB" stroke="#facc15" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="CMB" stroke="#60a5fa" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="TR" stroke="#f97316" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Répartition par catégorie */}
      {Object.keys(parCategorie).length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-sm text-gray-400 mb-3">Dépenses par catégorie</p>
          <div className="flex flex-col gap-2">
            {Object.entries(parCategorie).sort((a,b) => b[1]-a[1]).map(([cat, val]) => (
              <div key={cat} className="flex justify-between items-center">
                <span className="text-sm">{cat}</span>
                <span className="text-sm font-semibold text-red-400">{val.toFixed(2)} €</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}