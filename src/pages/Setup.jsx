import { useState } from "react"
import { db } from "../firebase"
import { doc, setDoc } from "firebase/firestore"
import { deriveKey, generateRecoveryKey, saveKeyLocally } from "../crypto"
import { Eye, EyeOff, Copy, Check } from "lucide-react"

export default function Setup({ onComplete }) {
  const [step, setStep] = useState(1)
  const [passphrase, setPassphrase] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState("")
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleCreatePassphrase = async () => {
    if (passphrase.length < 8) return setError("Passphrase trop courte (8 caractères minimum)")
    if (passphrase !== confirm) return setError("Les passphrases ne correspondent pas")
    setError("")
    const rk = generateRecoveryKey()
    setRecoveryKey(rk)
    setStep(2)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFinish = async () => {
    if (!confirmed) return setError("Tu dois confirmer avoir sauvegardé ta clé de récupération")
    setLoading(true)
    try {
      const { key, saltHex } = await deriveKey(passphrase)
      await saveKeyLocally(key, saltHex)

      // Stocker le salt et un hash de vérification dans Firestore
      const verif = await deriveKey(recoveryKey, saltHex)
      const verifExported = await crypto.subtle.exportKey("raw", verif.key)
      const verifHex = Array.from(new Uint8Array(verifExported)).map(b => b.toString(16).padStart(2,"0")).join("")

      await setDoc(doc(db, "config", "crypto"), {
        saltHex,
        recoveryVerif: verifHex,
        createdAt: new Date().toISOString()
      })

      onComplete(key)
    } catch (e) {
      setError("Erreur lors de la création : " + e.message)
    }
    setLoading(false)
  }

  if (step === 1) return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-emerald-400 mb-2">🔐 Chiffrement</h1>
          <p className="text-gray-400 text-sm">Crée une passphrase pour sécuriser tes données</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Passphrase</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Min. 8 caractères..."
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 pr-12"
              />
              <button onClick={() => setShow(s => !s)} className="absolute right-3 top-3 text-gray-400">
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Confirmer la passphrase</label>
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Répète ta passphrase..."
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="bg-gray-900 rounded-xl p-3 text-xs text-gray-400">
            ⚠️ Ta passphrase chiffre toutes tes données. Si tu la perds sans clé de récupération, tes données seront <span className="text-red-400 font-semibold">irrécupérables</span>.
          </div>

          <button
            onClick={handleCreatePassphrase}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition"
          >
            Continuer →
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-emerald-400 mb-2">🔑 Clé de récupération</h1>
          <p className="text-gray-400 text-sm">Note cette clé en lieu sûr — elle te permettra de récupérer tes données si tu oublies ta passphrase</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-5 flex flex-col gap-4">
          <div className="bg-gray-900 rounded-xl p-4">
            <p className="text-emerald-400 font-mono text-sm leading-relaxed break-all">
              {recoveryKey}
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Copié !" : "Copier la clé"}
          </button>

          <div className="bg-gray-900 rounded-xl p-3 text-xs text-gray-400">
            💡 Conseils : note-la sur papier, dans un gestionnaire de mots de passe, ou envoie-la à toi-même par email chiffré.
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="w-5 h-5 accent-emerald-500"
            />
            <span className="text-sm text-gray-300">J'ai sauvegardé ma clé de récupération en lieu sûr</span>
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleFinish}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
          >
            {loading ? "Chiffrement en cours..." : "✓ Terminer la configuration"}
          </button>
        </div>
      </div>
    </div>
  )
}