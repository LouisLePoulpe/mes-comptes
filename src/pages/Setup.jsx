import { DEFAULT_CATEGORIES } from '../domain/budget'
import Brand from "../components/Brand"
import { useState } from "react"
import { db } from "../firebase"
import { userDoc } from "../data/references"
import { runTransaction } from "firebase/firestore"
import { deriveKey, generateRecoveryKey, saveKeyLocally, encrypt } from "../crypto"
import { Eye, EyeOff, Copy, Check } from "lucide-react"

export default function Setup({ uid, onComplete }) {
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
      const recovery = await deriveKey(recoveryKey, saltHex)
      const rawKey = Array.from(new Uint8Array(await crypto.subtle.exportKey("raw", key)))
      const wrappedKey = await encrypt(rawKey, recovery.key)
      const encrypted = await encrypt({ verif: "ok" }, key)
      const configRef = userDoc(uid, "config", "crypto")
      const verifRef = userDoc(uid, "config", "verif")
      const defaults = await Promise.all(DEFAULT_CATEGORIES.map(async ({id,...data}) => ({ id, encrypted: await encrypt(data, key) })))
      await runTransaction(db, async transaction => {
        if ((await transaction.get(configRef)).exists()) throw new Error("Coffre déjà configuré : recharge la page")
        transaction.set(configRef, { saltHex, wrappedKey, createdAt: new Date().toISOString() })
        transaction.set(verifRef, { encrypted })
        for (const row of defaults) transaction.set(userDoc(uid, "categories", row.id), row.encrypted)
      })
      await saveKeyLocally(key, saltHex, uid)
      onComplete(key)
    } catch (e) {
      setError("Erreur lors de la création : " + e.message)
    }
    setLoading(false)
  }

  if (step === 1) return (
    <div className="min-h-screen bg-app text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <div className="mb-4"><Brand /></div><h1 className="text-3xl font-bold text-positive mb-2">Chiffrement</h1>
          <p className="text-muted text-sm">Crée une passphrase pour ton coffre personnel. Tu pourras ensuite importer ton export Excel dans l’historique. Si une migration de ton coffre existant est prévue, attends cette migration.</p>
        </div>

        <div className="bg-card rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <label htmlFor="Setup-passphrase" className="text-sm text-muted mb-1 block">Passphrase</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                id="Setup-passphrase"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Min. 8 caractères..."
                className="w-full bg-field border border-line rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-emerald-500 pr-12"
              />
              <button aria-label={show ? "Masquer la passphrase" : "Afficher la passphrase"} onClick={() => setShow(s => !s)} className="absolute right-3 top-3 text-muted">
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="Setup-confirm" className="text-sm text-muted mb-1 block">Confirmer la passphrase</label>
            <input
              type={show ? "text" : "password"}
              id="Setup-confirm"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Répète ta passphrase..."
              className="w-full bg-field border border-line rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>

          {error && <p role="alert" className="text-negative text-sm">{error}</p>}

          <div className="bg-panel rounded-xl p-3 text-xs text-muted">
            ⚠️ Ta passphrase chiffre toutes tes données. Si tu la perds sans clé de récupération, tes données seront <span className="text-negative font-semibold">irrécupérables</span>.
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
    <div className="min-h-screen bg-app text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-positive mb-2">🔑 Clé de récupération</h1>
          <p className="text-muted text-sm">Note cette clé en lieu sûr — elle te permettra de récupérer tes données si tu oublies ta passphrase</p>
        </div>

        <div className="bg-card rounded-2xl p-5 flex flex-col gap-4">
          <div className="bg-panel rounded-xl p-4">
            <p aria-label="Clé à conserver" className="text-positive font-mono text-sm leading-relaxed break-all">
              {recoveryKey}
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 bg-field hover:bg-hover text-foreground py-3 rounded-xl transition"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Copié !" : "Copier la clé"}
          </button>

          <div className="bg-panel rounded-xl p-3 text-xs text-muted">
            💡 Conseils : note-la sur papier, dans un gestionnaire de mots de passe, ou envoie-la à toi-même par email chiffré.
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="w-5 h-5 accent-emerald-500"
            />
            <span className="text-sm text-muted">J'ai sauvegardé ma clé de récupération en lieu sûr</span>
          </label>

          {error && <p role="alert" className="text-negative text-sm">{error}</p>}

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