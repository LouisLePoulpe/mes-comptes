import { App as NativeApp } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"
import { useState, useEffect } from "react"
import { auth } from "./firebase"
import { onIdTokenChanged } from "firebase/auth"
import { getVaultDoc } from "./data/offline"
import { loadKeyLocally, clearKeyLocally, decrypt } from "./crypto"
import { userDoc } from "./data/references"
import { logoutGoogle } from "./nativeAuth"
import Login, { VerifyEmail } from "./components/Login"
import Importer from "./pages/Importer"
import DataProvider from "./data/DataProvider"
import Settings from "./pages/Settings"
import Accounts from "./pages/Accounts"
import Dashboard from "./pages/Dashboard"
import Historique from "./pages/Historique"
import Ajouter from "./pages/Ajouter"
import Categories from "./pages/Categories"
import Recurring from "./pages/Recurring"
import Setup from "./pages/Setup"
import Unlock from "./pages/Unlock"
import { LayoutDashboard, History, PlusCircle, Settings as SettingsIcon } from "lucide-react"
import { deleteCurrentAccount, deletionPending } from './accountDeletion'

export default function App() {
  return <Application />
}

function Application() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState("dashboard")
  const [loading, setLoading] = useState(true)
  const [cryptoKey, setCryptoKey] = useState(null)
  const [cryptoState, setCryptoState] = useState("checking") // "checking" | "setup" | "unlock" | "ready"

  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deletionError, setDeletionError] = useState('')
  const [retryPassword, setRetryPassword] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const retry = () => setAttempt(value => value + 1)
    if (error) window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [error])
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
      if (u && deletionPending(u.uid)) { setLoading(false); return }
      try {
        if (u && !(u.providerData.some(provider => provider.providerId === "password") && !u.emailVerified)) {
          const config = await getVaultDoc(userDoc(u.uid, "config", "crypto"))
          const verif = config.exists() ? await getVaultDoc(userDoc(u.uid, "config", "verif")) : null
          let key = null
          if (config.exists()) {
            try {
              const local = await loadKeyLocally(u.uid)
              if (local && local.saltHex === config.data().saltHex && verif.exists() &&
                  (await decrypt(verif.data().encrypted, local.key)).verif === "ok") key = local.key
            } catch { clearKeyLocally(u.uid) }
          }
          if (current !== generation) return
          setCryptoKey(key)
          setCryptoState(!config.exists() ? "setup" : key ? "ready" : "unlock")
        }
      } catch {
        if (current === generation) setError("Coffre indisponible sur cet appareil. Reconnecte-toi à Internet pour le télécharger, puis réessaie.")
      } finally {
        if (current === generation) setLoading(false)
      }
    })
    return () => { generation++; unsub() }
  }, [attempt])

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
  const deleteAccount = async credentials => {
    setDeleting(true); setDeletionError('')
    try { await deleteCurrentAccount({ ...credentials, confirm: true }); setDeleting(false) }
    catch (cause) { setDeleting(false); setDeletionError(cause.code ? 'Suppression interrompue. Vérifie ton mot de passe et ta connexion, puis réessaie. Les étapes déjà terminées ne peuvent pas être annulées.' : cause.message) }
  }
  if (deleting) return <div className="min-h-screen flex items-center justify-center bg-app text-foreground p-6 text-center">Suppression de ton compte en cours…</div>

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-app text-foreground">
      Chargement...
    </div>
  )

  if (!user) return <Login />
  if (deletionError || deletionPending(user.uid)) return <section className="max-w-md mx-auto p-5 space-y-4">
    <h2 className="text-xl font-bold">Suppression du compte</h2>
    <p role="alert">{deletionError || 'Une suppression est en cours. Reprends-la pour supprimer les données restantes et ton accès.'}</p>
    <p>Ferme les autres sessions de ce compte avant de poursuivre.</p>
    <form onSubmit={event => { event.preventDefault(); deleteAccount({ password: retryPassword }) }} className="space-y-3">
      {user.providerData.some(p => p.providerId === 'password') && <input required type="password" autoComplete="current-password" aria-label="Mot de passe actuel" value={retryPassword} onChange={e => setRetryPassword(e.target.value)} />}
      <button type="submit">Réessayer la suppression</button>
    </form>
    <button onClick={() => { setDeletionError(''); logout() }}>Se déconnecter</button>
  </section>
  if (user.providerData.some(provider => provider.providerId === "password") && !user.emailVerified)
    return <VerifyEmail user={user} onLogout={logout} />

  if (error) return <div className="min-h-screen bg-app p-6 flex flex-col justify-center items-center gap-4"><p role="alert">{error}</p><button onClick={() => setAttempt(value => value + 1)}>Réessayer</button><button aria-label="Se déconnecter" onClick={logout}>Se déconnecter</button></div>

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
    { id: "settings", label: "Paramètres", icon: SettingsIcon },
  ]

  return (
    <div className="min-h-screen bg-app text-foreground flex flex-col">
      <DataProvider key={user.uid} uid={user.uid} cryptoKey={cryptoKey}>
      <main className="app-content flex-1 p-4 pb-20">
        {["accounts", "categories", "recurring"].includes(page) && <button className="settings-back" onClick={() => setPage("settings")}>← Paramètres</button>}
        {page === "dashboard" && <Dashboard cryptoKey={cryptoKey} />}
        {page === "historique" && <Historique cryptoKey={cryptoKey} />}
        {page === "ajouter" && <Ajouter cryptoKey={cryptoKey} onSuccess={() => setPage("historique")} />}
        {page === "categories" && <Categories cryptoKey={cryptoKey} />}
        {page === "recurring" && <Recurring cryptoKey={cryptoKey} />}
        {page === "import" && <Importer cryptoKey={cryptoKey} onClose={() => setPage("settings")} />}
        {page === "settings" && <Settings user={user} onLogout={logout} onAccounts={() => setPage("accounts")} onCategories={() => setPage("categories")} onRecurring={() => setPage("recurring")} onImport={() => setPage("import")} onDelete={deleteAccount} />}
        {page === "accounts" && <Accounts cryptoKey={cryptoKey} />}
      </main>
      </DataProvider>

      <nav className="app-nav fixed left-0 right-0 bg-panel border-line flex items-center justify-around z-50">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`flex flex-col items-center justify-center gap-1 px-1 sm:px-3 py-1 rounded-lg transition text-xs ${
              (page === id || (id === "settings" && ["accounts", "categories", "recurring"].includes(page))) ? "text-positive" : "text-muted hover:text-muted"
            }`}
          >
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
