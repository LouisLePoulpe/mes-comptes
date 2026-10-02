import { App as NativeApp } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"
import { useState, useEffect } from "react"
import { auth } from "./firebase"
import { onIdTokenChanged } from "firebase/auth"
import { getDoc } from "firebase/firestore"
import { loadKeyLocally, clearKeyLocally, decrypt } from "./crypto"
import { userDoc } from "./data/references"
import { logoutGoogle } from "./nativeAuth"
import Login, { VerifyEmail } from "./components/Login"
import Importer from "./pages/Importer"
import DataProvider from "./data/DataProvider"
import ThemeToggle from "./components/ThemeToggle"
import Settings from "./pages/Settings"
import Accounts from "./pages/Accounts"
import Dashboard from "./pages/Dashboard"
import Historique from "./pages/Historique"
import Ajouter from "./pages/Ajouter"
import Categories from "./pages/Categories"
import Setup from "./pages/Setup"
import Unlock from "./pages/Unlock"
import { LayoutDashboard, History, PlusCircle, Tags, LogOut, Settings as SettingsIcon } from "lucide-react"

export default function App() {
  return <><div className="fixed top-3 left-3 z-[250]"><ThemeToggle /></div><Application /></>
}

function Application() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState("dashboard")
  const [loading, setLoading] = useState(true)
  const [cryptoKey, setCryptoKey] = useState(null)
  const [cryptoState, setCryptoState] = useState("checking") // "checking" | "setup" | "unlock" | "ready"

  const [error, setError] = useState("")
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = NativeApp.addListener('backButton', () => {
      if (page !== 'dashboard') setPage('dashboard')
      else NativeApp.minimizeApp()
    })
    return () => { handle.then(listener => listener.remove()) }
  }, [page])

  useEffect(() => {
    let generation = 0
    const unsub = onIdTokenChanged(auth, async (u) => {
      const current = ++generation
      setUser(u)
      setCryptoKey(null)
      setCryptoState("checking")
      setError("")
      setPage("dashboard")
      setLoading(true)
      try {
        if (u && !(u.providerData.some(provider => provider.providerId === "password") && !u.emailVerified)) {
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

  const logout = () => {
    clearKeyLocally(user.uid)
    setCryptoKey(null)
    setCryptoState("checking")
    logoutGoogle().catch(() => setError("Déconnexion incomplète. Réessaie."))
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-app text-foreground">
      Chargement...
    </div>
  )

  if (!user) return <Login />
  if (user.providerData.some(provider => provider.providerId === "password") && !user.emailVerified)
    return <VerifyEmail user={user} onLogout={logout} />

  if (error) return <div role="alert">{error}<button aria-label="Se déconnecter" onClick={logout}>Se déconnecter</button></div>

  if (cryptoState === "checking") return (
    <div className="min-h-screen flex items-center justify-center bg-app text-foreground">
      Vérification du chiffrement...
    </div>
  )

  if (cryptoState === "setup" || cryptoState === "unlock") return (
    <>
      <button onClick={logout} className="fixed top-4 right-4 text-foreground z-10">Se déconnecter</button>
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
    { id: "settings", label: "Paramètres", icon: SettingsIcon },
  ]

  return (
    <div className="min-h-screen bg-app text-foreground flex flex-col">
      <header className="bg-panel border-b border-line pl-16 pr-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-positive">💰 Mes Comptes</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted hidden sm:block">{user.displayName || user.email}</span>
          <button aria-label="Se déconnecter" onClick={logout} className="text-muted hover:text-foreground transition">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <DataProvider key={user.uid} uid={user.uid} cryptoKey={cryptoKey}>
      <main className="flex-1 overflow-auto p-4 pb-20">
        {page === "dashboard" && <Dashboard cryptoKey={cryptoKey} />}
        {page === "historique" && <Historique cryptoKey={cryptoKey} onImport={() => setPage("import")} />}
        {page === "ajouter" && <Ajouter cryptoKey={cryptoKey} onSuccess={() => setPage("historique")} />}
        {page === "categories" && <Categories cryptoKey={cryptoKey} />}
        {page === "import" && <Importer cryptoKey={cryptoKey} onClose={() => setPage("historique")} />}
        {page === "settings" && <Settings user={user} onImport={() => setPage("import")} />}
        {page === "accounts" && <Accounts cryptoKey={cryptoKey} />}
      </main>
      </DataProvider>

      <nav className="fixed bottom-0 left-0 right-0 bg-panel border-t border-line flex justify-around py-2 z-50">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`flex flex-col items-center gap-1 px-1 sm:px-3 py-1 rounded-lg transition text-xs ${
              page === id ? "text-positive" : "text-muted hover:text-muted"
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