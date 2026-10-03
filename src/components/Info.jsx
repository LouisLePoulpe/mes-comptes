import { useRef } from 'react'
import { Info as InfoIcon } from 'lucide-react'

export default function Info({ title, children }) {
  const ref = useRef(null)
  return <>
    <button type="button" className="inline-flex items-center justify-center rounded-full text-muted hover:text-foreground" aria-label={`Afficher les explications : ${title}`} onClick={() => ref.current?.showModal()}>
      <InfoIcon size={16} />
    </button>
    <dialog ref={ref} className="info-dialog bg-card text-foreground rounded-2xl p-5 max-w-md shadow-xl" onClick={event => { if (event.target === ref.current) ref.current.close() }}>
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="text-sm text-muted space-y-2">{children}</div>
      <button type="button" className="mt-4 rounded-lg bg-field px-3 py-2" onClick={() => ref.current?.close()}>Fermer</button>
    </dialog>
  </>
}
