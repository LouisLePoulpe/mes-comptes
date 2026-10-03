import { useMemo, useState } from 'react'
import { useData } from '../data/context'
import { createExport, downloadExport, canShareExport, shareExport } from '../transfer/export'
import { isAndroid, saveAndroidExport, shareAndroidExport } from '../transfer/native'

export default function ExportActions() {
  const { transactions, accounts } = useData()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // Prebuild the file before the click so Web Share retains user activation.
  const file = useMemo(() => createExport(transactions, id => accounts.find(a => a.id === id)?.name || id), [transactions, accounts])
  async function save() {
    setMessage('')
    if (!isAndroid()) { downloadExport(file); setMessage('Téléchargement lancé : mes-comptes.xlsx.'); return }
    setBusy(true)
    try { const result = await saveAndroidExport(file); setMessage(result.cancelled ? 'Enregistrement annulé.' : 'Export enregistré.') }
    catch (error) { setMessage(`Enregistrement impossible (${error.code || 'EXPORT_UNKNOWN'}). Essaie « Partager l’export » et signale ce code si le problème persiste.`) }
    finally { setBusy(false) }
  }
  async function share() {
    setBusy(true); setMessage('')
    try {
      const result = isAndroid() ? await shareAndroidExport(file) : await shareExport(file)
      setMessage(result === 'cancelled' ? 'Partage annulé. Aucun fichier envoyé.' : 'Partage terminé.')
    } catch { setMessage('Partage impossible. Utilise « Export Excel » pour enregistrer le fichier.') }
    finally { setBusy(false) }
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <button onClick={save} disabled={busy} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl">Export Excel</button>
      {(isAndroid() || canShareExport(file)) && <button onClick={share} disabled={busy} className="bg-field text-foreground text-sm px-4 py-2 rounded-xl">Partager l’export</button>}
    </div>
    {message && <p role="status" className="text-sm text-muted max-w-xs">{message}</p>}
  </div>
}
