import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './mobile-site-menu.css'

export default function MobileSiteMenu({ id, title, onClose, children }: { id: string; title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey) }
  }, [onClose])
  return createPortal(<div className="site-mobile-menu" id={id} role="dialog" aria-modal="true" aria-label={title}>
    <button type="button" className="site-mobile-menu-scrim" onClick={onClose} aria-label="Fermer le menu"/>
    <div className="site-mobile-menu-panel"><div className="site-mobile-menu-head"><strong>{title}</strong><button type="button" ref={closeRef} onClick={onClose} aria-label="Fermer le menu"><X/></button></div><nav aria-label={title}>{children}</nav></div>
  </div>, document.body)
}
