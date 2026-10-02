import { Capacitor } from '@capacitor/core'
import { useState } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth'
import { auth } from '../firebase'
import { loginGoogle } from '../nativeAuth'

const field = 'w-full rounded-lg bg-field border border-line p-3'
export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setError(''); setMessage('')
    if (mode === 'signup' && password !== confirmation) return setError('Les mots de passe ne correspondent pas.')
    setBusy(true)
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim())
        setMessage('Si un compte correspond à cette adresse, un e-mail de réinitialisation sera envoyé. Vérifie aussi les indésirables.')
      } else if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await sendEmailVerification(result.user)
      } else await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (e) {
      setError(e.code === 'auth/email-already-in-use' ? 'Cette adresse possède déjà un compte. Connecte-toi avec ta méthode habituelle ou utilise « Mot de passe oublié ».'
        : e.code === 'auth/weak-password' ? 'Choisis un mot de passe plus robuste.'
        : e.code === 'auth/too-many-requests' ? 'Trop de tentatives. Réessaie plus tard.'
        : e.code === 'auth/operation-not-allowed' ? 'La connexion par e-mail doit encore être activée par l’administrateur.'
        : 'Opération impossible. Vérifie ton adresse, ton mot de passe et ta connexion.')
    } finally { setBusy(false) }
  }
  function changeMode(next) { setMode(next); setError(''); setMessage(''); setPassword(''); setConfirmation('') }
  async function google() {
    setBusy(true); setError('')
    try { await loginGoogle() } catch (e) { setError(e.message?.includes('préversion Android') ? e.message : 'Connexion Google annulée ou impossible.') }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-app text-foreground flex items-center justify-center px-4 py-20">
    <section className="w-full max-w-md space-y-5">
      <h1 className="text-3xl font-bold text-positive">💰 Mes Comptes</h1>
      <h2 className="text-xl">{mode === 'signup' ? 'Créer un compte' : mode === 'reset' ? 'Mot de passe oublié' : 'Connexion'}</h2>
      <p className="text-muted">Utilise ton adresse e-mail habituelle, quel que soit ton fournisseur.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">Adresse e-mail<input className={field} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        {mode !== 'reset' && <label className="block">Mot de passe<input className={field} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 12 : undefined} value={password} onChange={e => setPassword(e.target.value)} /></label>}
        {mode === 'signup' && <><p className="text-sm text-muted">Au moins 12 caractères. Choisis un mot de passe propre à Mes Comptes.</p><label className="block">Confirmer le mot de passe<input className={field} type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label></>}
        {error && <p role="alert" className="text-negative">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button disabled={busy} className="w-full bg-emerald-600 text-white p-3 rounded-lg disabled:opacity-50">{busy ? 'Patiente…' : mode === 'signup' ? 'Créer mon compte' : mode === 'reset' ? 'Envoyer le lien' : 'Se connecter'}</button>
      </form>
      <div className="flex flex-wrap gap-4">
        <button disabled={busy} onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Créer un compte' : 'Retour à la connexion'}</button>
        {mode === 'login' && <button disabled={busy} onClick={() => changeMode('reset')}>Mot de passe oublié</button>}
      </div>
      {(!Capacitor.isNativePlatform() || import.meta.env.VITE_ANDROID_CONFIGURED === 'true') && <button disabled={busy} onClick={google} className="w-full border border-line rounded-lg p-3">Se connecter avec Google</button>}
      {Capacitor.isNativePlatform() && import.meta.env.VITE_V2_USE_PRODUCTION !== 'true' && <p role="note" className="text-muted">Préversion de test : la connexion à tes comptes réels n’est pas encore disponible.</p>}
      <p className="text-sm text-muted">Le mot de passe du compte et la passphrase de ton coffre sont distincts. Réinitialiser le mot de passe ne déverrouille pas les données chiffrées.</p>
    </section>
  </main>
}

export function VerifyEmail({ user, onLogout }) {
  const [message, setMessage] = useState('Vérifie ta boîte e-mail, puis confirme ci-dessous. Tu peux renvoyer le message si nécessaire.')
  const [busy, setBusy] = useState(false)
  async function action(resend) {
    setBusy(true)
    try {
      if (resend) { await sendEmailVerification(user); setMessage('E-mail envoyé. Vérifie aussi les indésirables.') }
      else {
        await user.reload()
        await user.getIdToken(true)
        if (!user.emailVerified) setMessage('Cette adresse n’est pas encore vérifiée.')
      }
    } catch { setMessage('Vérification impossible pour le moment. Réessaie plus tard.') }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-app text-foreground flex flex-col items-center justify-center gap-5 p-6">
    <h1 className="text-2xl">Vérifie ton adresse e-mail</h1><p>{user.email}</p><p role="status">{message}</p>
    <button disabled={busy} onClick={() => action(false)}>J’ai vérifié mon adresse</button>
    <button disabled={busy} onClick={() => action(true)}>Renvoyer l’e-mail</button>
    <button onClick={onLogout}>Se déconnecter</button>
  </main>
}
