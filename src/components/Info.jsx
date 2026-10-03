import { useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { Info as InfoIcon } from 'lucide-react'

export default function Info({ title, children }) {
  const ref = useRef(null)
  const id = useId()
  return <>
    <button type="button" className="inline-flex items-center justify-center rounded-full text-muted hover:text-foreground" aria-label={`Afficher les explications : ${title}`} onClick={() => ref.current?.showModal()}>
      <InfoIcon size={16} />
    </button>
    {createPortal(<dialog aria-labelledby={id} ref={ref} className="info-dialog bg-card text-foreground rounded-2xl p-5 max-w-md shadow-xl">
      <h3 id={id} className="font-semibold mb-3">{title}</h3>
      <div className="text-sm text-muted space-y-2">{children}</div>
      <button type="button" className="mt-4 rounded-lg bg-field px-3 py-2" onClick={() => ref.current?.close()}>Fermer</button>
    </dialog>, document.body)}
  </>
}
