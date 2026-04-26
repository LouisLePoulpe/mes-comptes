import { useState } from "react"
import { db } from "../firebase"
import { doc, getDoc } from "firebase/firestore"
import { deriveKey, saveKeyLocally } from "../crypto"
import { Eye, EyeOff } from "lucide-react"

export default function Unlock({ onComplete }) {
  const [mode, setMode] = useState("passphrase") // "passphrase" | "recovery"
  const [passphrase, setPassphrase] = useState("")
  const [recoveryKey, setRecoveryKey] = useState("")
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleUnlock = async () => {
    setLoading(true)
    setError("")
    try {
      // Récupérer le salt depuis Firestore
      const configDoc = await getDoc(doc(db, "config", "crypto"))
      if (!configDoc.exists()) throw new Error("Configuration introuvable")
      const { saltHex } = configDoc.data()

      // Dériver la clé depuis la passphrase
      const { key } = await deriveKey(passphrase, saltHex)

      // Vérifier que la clé est correcte en tentant de déchiffrer un doc test
      // On stocke un petit doc de vérification lors du setup
      const verifDoc = await getDoc(doc(db, "config", "verif"))
      if (verifDoc.exists()) {
        const { encrypted } = verifDoc.data()
        try {
          const { decrypt } = await import("../crypto")
          await decrypt(encrypted, key)
        } catch {
          throw new Error("Passphrase incorrecte")
        }
      }

      await saveKeyLocally(key, saltHex)
      onComplete(key)
    } catch (e) {
      setError(e.message || "Passphrase incorrecte")
    }
    setLoading(false)
  }

  const handleRecovery = async () => {
    setLoading(true)
    setError("")
    try {
      const configDoc = await getDoc(doc(db, "config", "crypto"))
      if (!configDoc.exists()) throw new Error("Configuration introuvable")
      const { saltHex, recoveryVerif } = configDoc.data()

      // Vérifier la clé de récupération
      const { key: recoveryDerived } = await deriveKey(recoveryKey.trim(), saltHex)
      const exported = await crypto.subtle.exportKey("raw", recoveryDerived)
      const verifHex = Array.from(new Uint8Array(exported)).map(b => b.toString(16).padStart(2,"0")).join("")

      if (verifHex !== recoveryVerif) throw new Error("Clé de récupération incorrecte")

      // Clé valide — demander une nouvelle passphrase
      alert("Clé de récupération valide ! Tu vas devoir reconfigurer une nouvelle passphrase.")
      // Reset la config pour forcer un nouveau Setup
      localStorage.clear()
      window.location.reload()
    } catch (e) {
      setError(e.message || "Clé de récupération incorrecte")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-emerald-400 mb-2">🔐 Mes Comptes</h1>
          <p className="text-gray-400 text-sm">Entre ta passphrase pour accéder à tes données</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-5 flex flex-col gap-4">

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("passphrase"); setError("") }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                mode === "passphrase" ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"
              }`}
            >Passphrase</button>
            <button
              onClick={() => { setMode("recovery"); setError("") }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                mode === "recovery" ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"
              }`}
            >Clé de récupération</button>
          </div>

          {mode === "passphrase" ? (
            <>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Passphrase</label>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={passphrase}
                    onChange={e => setPassphrase(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleUnlock()}
                    placeholder="Ta passphrase..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 pr-12"
                  />
                  <button onClick={() => setShow(s => !s)} className="absolute right-3 top-3 text-gray-400">
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                onClick={handleUnlock}
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
              >
                {loading ? "Vérification..." : "🔓 Déverrouiller"}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Clé de récupération (24 mots)</label>
                <textarea
                  value={recoveryKey}
                  onChange={e => setRecoveryKey(e.target.value)}
                  placeholder="mot1-mot2-mot3-..."
                  rows={4}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 font-mono text-sm"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                onClick={handleRecovery}
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
              >
                {loading ? "Vérification..." : "🔑 Récupérer l'accès"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}