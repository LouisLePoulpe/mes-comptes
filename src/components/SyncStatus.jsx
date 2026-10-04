import { RefreshCw } from 'lucide-react'
import { useData } from '../data/context'
import Info from './Info'

const labels = { synced: 'Synchronisé', syncing: 'Synchronisation en cours', offline: 'Hors ligne' }

export default function SyncStatus() {
  const { syncState, pending } = useData()
  return <Info title="Synchronisation" buttonLabel={`Synchronisation : ${labels[syncState]}`}
    buttonClassName={`sync-indicator sync-${syncState}`}
    icon={<RefreshCw size={18} aria-hidden="true" />}>
    <p>{labels[syncState]}.</p>
    <p>{pending ? 'Tes modifications sont enregistrées sur cet appareil. Elles seront envoyées dès que la connexion le permettra.' : syncState === 'offline' ? 'Ton historique est disponible sur cet appareil. Tu peux continuer à saisir tes opérations.' : syncState === 'syncing' ? 'L’application vérifie les dernières données du cloud.' : 'Tes modifications ont été transmises au cloud.'}</p>
    <p>Vert : synchronisé. Orange : synchronisation en cours. Rouge : hors ligne.</p>
  </Info>
}
