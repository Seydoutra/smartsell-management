import { useState } from 'react'
import { ExternalLink, Link2, Search, X } from 'lucide-react'
import { canvaAction, type CanvaDesign } from './services/repository'
import type { EditorialItem } from './types/models'
import './editorial-canva-field.css'

export default function EditorialCanvaField({ item }: { item?: EditorialItem }) {
  const [chosen, setChosen] = useState<{ id: string; title: string } | null>(item?.canva_design_id ? { id: item.canva_design_id, title: item.canva_design_title || 'Création Canva' } : null)
  const [designs, setDesigns] = useState<CanvaDesign[]>([])
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const choose = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await canvaAction<{ items: CanvaDesign[] }>('designs')
      setDesigns(result.items)
      setShowPicker(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Créations Canva indisponibles. Connectez Canva dans Intégrations.')
    } finally {
      setBusy(false)
    }
  }

  const openDesign = async () => {
    if (!chosen) return
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    setBusy(true)
    setError('')
    try {
      const design = await canvaAction<CanvaDesign>('design', chosen.id)
      const url = design.edit_url || design.view_url
      if (!url || !/^https:\/\//.test(url)) throw new Error('Lien Canva indisponible pour ce design.')
      if (tab) tab.location.replace(url)
      else setError('Autorisez les fenêtres contextuelles pour ouvrir Canva.')
    } catch (cause) {
      tab?.close()
      setError(cause instanceof Error ? cause.message : 'Impossible d’ouvrir ce design.')
    } finally {
      setBusy(false)
    }
  }

  const filtered = designs.filter(design => (design.title || '').toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  return <div className="editorial-canva-field">
    <input type="hidden" name="canva_design_id" value={chosen?.id || ''} />
    <input type="hidden" name="canva_design_title" value={chosen?.title || ''} />
    <div className="editorial-canva-heading"><span className="canva-mark">C</span><div><strong>Visuel Canva</strong><small>Associez une création à cette publication du calendrier.</small></div></div>
    {chosen && <div className="editorial-canva-chosen"><Link2 size={16}/><strong>{chosen.title}</strong><button type="button" disabled={busy} onClick={() => void openDesign()}><ExternalLink size={15}/> Ouvrir</button><button type="button" aria-label="Dissocier ce design" onClick={() => setChosen(null)}><X size={15}/></button></div>}
    <button className="ghost-action" type="button" disabled={busy} onClick={() => void choose()}>{busy ? 'Chargement…' : chosen ? 'Changer de design Canva' : 'Choisir un design Canva'}</button>
    {error && <p className="editorial-canva-error" role="alert">{error} <a href="#/Intégrations">Ouvrir Intégrations</a></p>}
    {showPicker && <div className="editorial-canva-picker"><label><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher une création" /></label><div className="editorial-canva-results">{filtered.length ? filtered.map(design => <button type="button" key={design.id} onClick={() => { setChosen({ id: design.id, title: design.title || 'Création sans titre' }); setShowPicker(false) }}>{design.thumbnail ? <img src={design.thumbnail} alt="" loading="lazy"/> : <span className="canva-mark">C</span>}<span>{design.title || 'Création sans titre'}</span></button>) : <p>Aucune création trouvée.</p>}</div></div>}
  </div>
}
