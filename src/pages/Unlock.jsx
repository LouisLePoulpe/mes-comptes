import { useState } from "react"
import { userDoc } from "../data/references"
import { getDoc } from "firebase/firestore"
import { deriveKey, saveKeyLocally, decrypt } from "../crypto"
import { Eye, EyeOff } from "lucide-react"

export default function Unlock({ uid, onComplete }) {
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
      const configDoc = await getDoc(userDoc(uid, "config", "crypto"))
      if (!configDoc.exists()) throw new Error("Configuration introuvable")
      const { saltHex } = configDoc.data()

      // Dériver la clé depuis la passphrase
      const { key } = await deriveKey(passphrase, saltHex)

      // Vérifier que la clé est correcte en tentant de déchiffrer un doc test
      // On stocke un petit doc de vérification lors du setup
      const verifDoc = await getDoc(userDoc(uid, "config", "verif"))
      if (!verifDoc.exists()) throw new Error("Document de vérification manquant : restauration requise")
      if (verifDoc.exists()) {
        const { encrypted } = verifDoc.data()
        try {
          if ((await decrypt(encrypted, key)).verif !== "ok") throw new Error("Vérification invalide")
        } catch {
          throw new Error("Passphrase incorrecte")
        }
      }

      await saveKeyLocally(key, saltHex, uid)
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
      const configDoc = await getDoc(userDoc(uid, "config", "crypto"))
      if (!configDoc.exists()) throw new Error("Configuration introuvable")
      const { saltHex, wrappedKey } = configDoc.data()
      if (!wrappedKey) throw new Error("La récupération V1 ne contient pas la clé de chiffrement. Utilise ta passphrase d’origine ou un appareil déjà déverrouillé.")
      const { key: recoveryDerived } = await deriveKey(recoveryKey.trim(), saltHex)
      const raw = await decrypt(wrappedKey, recoveryDerived)
      const key = await crypto.subtle.importKey("raw", new Uint8Array(raw), "AES-GCM", true, ["encrypt", "decrypt"])
      const verif = await getDoc(userDoc(uid, "config", "verif"))
      if (!verif.exists() || (await decrypt(verif.data().encrypted, key)).verif !== "ok") throw new Error("Vérification impossible")
      await saveKeyLocally(key, saltHex, uid)
      onComplete(key)
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