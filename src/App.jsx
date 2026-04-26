import { useState, useEffect } from "react"
import { auth, googleProvider, db } from "./firebase"
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { loadKeyLocally, clearKeyLocally, encrypt, decrypt } from "./crypto"
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        await checkCryptoState()
      } else {
        setCryptoState("checking")
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const checkCryptoState = async () => {
    // Vérifier si la config crypto existe dans Firestore
    const configDoc = await getDoc(doc(db, "config", "crypto"))
    if (!configDoc.exists()) {
      // Première fois — setup requis
      setCryptoState("setup")
      return
    }

    // Config existe — vérifier si la clé est en local
    const localKey = await loadKeyLocally()
    if (localKey) {
      setCryptoKey(localKey.key)
      setCryptoState("ready")
    } else {
      // Clé pas en local — demander la passphrase
      setCryptoState("unlock")
    }
  }

  const handleSetupComplete = async (key) => {
    // Créer un doc de vérification chiffré
    const encrypted = await encrypt({ verif: "ok" }, key)
    await setDoc(doc(db, "config", "verif"), { encrypted })
    setCryptoKey(key)
    setCryptoState("ready")
  }

  const handleUnlockComplete = (key) => {
    setCryptoKey(key)
    setCryptoState("ready")
  }

  const login = () => signInWithPopup(auth, googleProvider)
  const logout = () => {
    clearKeyLocally()
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
      <button
        onClick={login}
        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8 py-3 rounded-xl transition"
      >
        Se connecter avec Google
      </button>
    </div>
  )

  if (cryptoState === "checking") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      Vérification du chiffrement...
    </div>
  )

  if (cryptoState === "setup") return <Setup onComplete={handleSetupComplete} />
  if (cryptoState === "unlock") return <Unlock onComplete={handleUnlockComplete} />

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "historique", label: "Historique", icon: History },
    { id: "ajouter", label: "Ajouter", icon: PlusCircle },
    { id: "categories", label: "Catégories", icon: Tags },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-emerald-400">💰 Mes Comptes</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">{user.displayName}</span>
          <button onClick={logout} className="text-gray-400 hover:text-white transition">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 pb-20">
        {page === "dashboard" && <Dashboard cryptoKey={cryptoKey} />}
        {page === "historique" && <Historique cryptoKey={cryptoKey} />}
        {page === "ajouter" && <Ajouter cryptoKey={cryptoKey} onSuccess={() => setPage("historique")} />}
        {page === "categories" && <Categories cryptoKey={cryptoKey} />}
      </main>

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