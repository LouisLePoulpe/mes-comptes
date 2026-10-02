import { useState, useEffect } from "react"
import { auth, googleProvider } from "./firebase"
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth"
import { getDoc } from "firebase/firestore"
import { loadKeyLocally, clearKeyLocally, decrypt } from "./crypto"
import { userDoc } from "./data/references"
import DataProvider from "./data/DataProvider"
import Accounts from "./pages/Accounts"
import Dashboard from "./pages/Dashboard"
import Historique from "./pages/Historique"
import Ajouter from "./pages/Ajouter"
import Categories from "./pages/Categories"
import Setup from "./pages/Setup"
import Unlock from "./pages/Unlock"
import { LayoutDashboard, History, PlusCircle, Tags, LogOut } from "lucide-react"

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState("dashboard")
  const [loading, setLoading] = useState(true)
  const [cryptoKey, setCryptoKey] = useState(null)
  const [cryptoState, setCryptoState] = useState("checking") // "checking" | "setup" | "unlock" | "ready"

  const [error, setError] = useState("")
  useEffect(() => {
    let generation = 0
    const unsub = onAuthStateChanged(auth, async (u) => {
      const current = ++generation
      setUser(u)
      setCryptoKey(null)
      setCryptoState("checking")
      setError("")
      setPage("dashboard")
      setLoading(true)
      try {
        if (u) {
          const config = await getDoc(userDoc(u.uid, "config", "crypto"))
          let key = null
          if (config.exists()) {
            try {
              const local = await loadKeyLocally(u.uid)
              const verif = await getDoc(userDoc(u.uid, "config", "verif"))
              if (local && local.saltHex === config.data().saltHex && verif.exists() &&
                  (await decrypt(verif.data().encrypted, local.key)).verif === "ok") key = local.key
            } catch { clearKeyLocally(u.uid) }
          }
          if (current !== generation) return
          setCryptoKey(key)
          setCryptoState(!config.exists() ? "setup" : key ? "ready" : "unlock")
        }
      } catch {
        if (current === generation) setError("Impossible de vérifier ton coffre. Vérifie la connexion et les autorisations.")
      } finally {
        if (current === generation) setLoading(false)
      }
    })
    return () => { generation++; unsub() }
  }, [])

  const handleComplete = (key) => {
    if (auth.currentUser?.uid !== user.uid) return
    setCryptoKey(key)
    setCryptoState("ready")
  }

  const login = async () => {
    setError("")
    try { await signInWithPopup(auth, googleProvider) }
    catch { setError("Connexion annulée ou impossible. Tu peux réessayer.") }
  }
  const logout = () => {
    clearKeyLocally(user.uid)
    setCryptoKey(null)
    setCryptoState("checking")
    signOut(auth)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      Chargement...
    </div>
  )

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-6">
      <h1 className="text-4xl font-bold text-emerald-400">💰 Mes Comptes</h1>
      <p className="text-gray-400">Connecte-toi pour accéder à tes finances</p>
      {error && <p role="alert">{error}</p>}
      <button
        onClick={login}
        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8 py-3 rounded-xl transition"
      >
        Se connecter avec Google
      </button>
    </div>
  )

  if (error) return <div role="alert">{error}<button aria-label="Se déconnecter" onClick={logout}>Se déconnecter</button></div>

  if (cryptoState === "checking") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      Vérification du chiffrement...
    </div>
  )

  if (cryptoState === "setup" || cryptoState === "unlock") return (
    <>
      <button onClick={logout} className="fixed top-4 right-4 text-white z-10">Se déconnecter</button>
      {cryptoState === "setup"
        ? <Setup key={user.uid} uid={user.uid} onComplete={handleComplete} />
        : <Unlock key={user.uid} uid={user.uid} onComplete={handleComplete} />}
    </>
  )

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "historique", label: "Historique", icon: History },
    { id: "ajouter", label: "Ajouter", icon: PlusCircle },
    { id: "accounts", label: "Comptes", icon: Tags },
    { id: "categories", label: "Catégories", icon: Tags },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-emerald-400">💰 Mes Comptes</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">{user.displayName}</span>
          <button aria-label="Se déconnecter" onClick={logout} className="text-gray-400 hover:text-white transition">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <DataProvider key={user.uid} uid={user.uid} cryptoKey={cryptoKey}>
      <main className="flex-1 overflow-auto p-4 pb-20">
        {page === "dashboard" && <Dashboard cryptoKey={cryptoKey} />}
        {page === "historique" && <Historique cryptoKey={cryptoKey} />}
        {page === "ajouter" && <Ajouter cryptoKey={cryptoKey} onSuccess={() => setPage("historique")} />}
        {page === "categories" && <Categories cryptoKey={cryptoKey} />}
        {page === "accounts" && <Accounts cryptoKey={cryptoKey} />}
      </main>
      </DataProvider>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex justify-around py-2 z-50">
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