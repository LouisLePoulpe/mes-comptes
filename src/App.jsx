import { useState, useEffect } from "react"
import { auth, googleProvider } from "./firebase"
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth"
import Dashboard from "./pages/Dashboard"
import Historique from "./pages/Historique"
import Ajouter from "./pages/Ajouter"
import Categories from "./pages/Categories"
import { LayoutDashboard, History, PlusCircle, Tags, LogOut } from "lucide-react"

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState("dashboard")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  const login = () => signInWithPopup(auth, googleProvider)
  const logout = () => signOut(auth)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      Chargement...
    </div>
  )

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-6">
      <h1 className="text-4xl font-bold text-emerald-400">💰 Mes Comptes</h1>
      <p className="text-gray-400">Connecte-toi pour accéder à tes finances</p>
      <button
        onClick={login}
        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8 py-3 rounded-xl transition"
      >
        Se connecter avec Google
      </button>
    </div>
  )

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "historique", label: "Historique", icon: History },
    { id: "ajouter", label: "Ajouter", icon: PlusCircle },
    { id: "categories", label: "Catégories", icon: Tags },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-emerald-400">💰 Mes Comptes</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">{user.displayName}</span>
          <button onClick={logout} className="text-gray-400 hover:text-white transition">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-1 overflow-auto p-4">
        {page === "dashboard" && <Dashboard />}
        {page === "historique" && <Historique />}
        {page === "ajouter" && <Ajouter onSuccess={() => setPage("historique")} />}
        {page === "categories" && <Categories />}
      </main>

      {/* Navigation bas (mobile) */}
      <nav className="bg-gray-900 border-t border-gray-800 flex justify-around py-2">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition text-xs ${
              page === id ? "text-emerald-400" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}