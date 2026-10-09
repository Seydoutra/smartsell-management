import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarClock, Mail, Phone, Plus, RefreshCw, Search, Target, X } from 'lucide-react'
import type { Prospect, Service } from './types/models'
import { commercialStages, isOpenProspect, offerFocus, rankedProspects, type ModuleIntent } from './lib/commercialPipeline'
import { loadCommercialOffers, loadCommercialProspects, moveCommercialProspect, saveCommercialProspect } from './services/commercialPipelineRepository'
import './commercialPipeline.css'

type Rights={view:boolean;create:boolean;update:boolean;delete:boolean}
const dateLabel=(value:string|null)=>value?new Date(value).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'Non planifiée'
const localDate=(value:string|null)=>{if(!value)return '';const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';return new Date(date.getTime()-date.getTimezoneOffset()*60_000).toISOString().slice(0,16)}
const blank=():Partial<Prospect>=>({company:'',stage:'NOUVEAU',source:'Prospection commerciale',sms_opt_in:false,email_opt_in:false,marketing_opt_in:false})

export default function CommercialPipeline({tenantOwnerId,rights,canViewOffers=false,intent={}}:{tenantOwnerId:string;rights:Rights;canViewOffers?:boolean;intent?:ModuleIntent}) {
  const [prospects,setProspects]=useState<Prospect[]>([]),[services,setServices]=useState<Service[]>([])
  const [loading,setLoading]=useState(true),[loadFailed,setLoadFailed]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[offerError,setOfferError]=useState('')
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('ALL'),[selected,setSelected]=useState<Partial<Prospect>|null>(null),[busy,setBusy]=useState(false),[reload,setReload]=useState(0),[clock,setClock]=useState(Date.now())
  const lastRequest=useRef(''),lock=useRef(false),dialogRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),60_000);return()=>window.clearInterval(timer)},[])
  useEffect(()=>{
    let current=true
    setProspects([]);setServices([]);setSelected(null);setLoading(true);setLoadFailed(false);setError('');setNotice('');setOfferError('')
    if(!rights.view){setLoading(false);return()=>{current=false}}
    void loadCommercialProspects(tenantOwnerId).then(rows=>{if(current)setProspects(rows)}).catch(cause=>{if(current){setError(cause instanceof Error?cause.message:'Chargement impossible.');setLoadFailed(true)}}).finally(()=>{if(current)setLoading(false)})
    if(canViewOffers)void loadCommercialOffers(tenantOwnerId).then(rows=>{if(current)setServices(rows)}).catch(()=>{if(current)setOfferError('Catalogue indisponible. Les priorités prospects restent accessibles.')})
    return()=>{current=false}
  },[tenantOwnerId,rights.view,canViewOffers,reload])
  useEffect(()=>{
    const request=intent.request||intent.action||''
    if(intent.action==='new-prospect'&&request!==lastRequest.current&&!loading&&!loadFailed&&rights.create){lastRequest.current=request;setSelected(blank())}
  },[intent.action,intent.request,loading,loadFailed,rights.create])
  useEffect(()=>{
    if(!selected)return
    const previous=document.activeElement as HTMLElement|null
    dialogRef.current?.focus()
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!lock.current)setSelected(null)
      if(event.key==='Tab'){
        const fields=dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')
        if(!fields?.length)return
        const first=fields[0],last=fields[fields.length-1]
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===dialogRef.current)){event.preventDefault();first.focus()}
      }
    }
    document.addEventListener('keydown',key)
    return()=>{document.removeEventListener('keydown',key);previous?.focus()}
  },[Boolean(selected)])
  const priorities=useMemo(()=>rankedProspects(prospects,clock),[prospects,clock])
  const offers=useMemo(()=>offerFocus(prospects,services,clock),[prospects,services,clock])
  const displayed=prospects.filter(p=>(filter==='ALL'||p.stage===filter)&&[p.company,p.contact_name,p.need,p.sector].some(value=>value?.toLocaleLowerCase().includes(search.toLocaleLowerCase())))
  const due=priorities.filter(row=>row.prospect.next_follow_up_at&&Date.parse(row.prospect.next_follow_up_at)<=clock).length
  const writable=Boolean(selected&&(selected.id?rights.update:rights.create))
  const replace=(row:Prospect)=>setProspects(current=>current.some(p=>p.id===row.id)?current.map(p=>p.id===row.id?row:p):[row,...current])
  const move=async(id:string,stage:string)=>{
    if(!rights.update||lock.current||!prospects.some(p=>p.id===id)||prospects.find(p=>p.id===id)?.stage===stage)return
    lock.current=true;setBusy(true);setError('');setNotice('')
    try{replace(await moveCommercialProspect(tenantOwnerId,id,stage));setNotice('Étape commerciale enregistrée.')}catch(cause){setError(cause instanceof Error?cause.message:'Mise à jour impossible.')}finally{lock.current=false;setBusy(false)}
  }
  if(!rights.view)return <p className="muted">Le pipeline n’est pas accessible avec vos droits actuels.</p>
  return <section className="commercial-workspace" aria-label="Pipeline commercial">
    <div className="commercial-heading"><div><span className="eyebrow"><i/> PILOTAGE COMMERCIAL</span><h2>Du premier contact à la décision.</h2><p>Des relances concrètes, un suivi partagé et des offres adaptées aux besoins exprimés.</p></div><div className="commercial-actions"><button className="secondary-btn" disabled={loading||busy} onClick={()=>setReload(value=>value+1)}><RefreshCw/>Actualiser</button>{rights.create&&<button className="primary-btn compact" disabled={loading||loadFailed||busy} onClick={()=>{setError('');setSelected(blank())}}><Plus/>Nouveau prospect</button>}</div></div>
    {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="commercial-notice" role="status">{notice}</p>}
    {loading?<p role="status">Chargement du pipeline…</p>:loadFailed?<button className="secondary-btn" onClick={()=>setReload(value=>value+1)}>Réessayer le chargement</button>:<>
      <div className="commercial-kpis">{[[priorities.length,'Opportunités ouvertes'],[due,'Relances à effectuer'],[prospects.filter(p=>p.stage==='GAGNE').length,'Opportunités gagnées'],[prospects.filter(p=>p.stage==='PERDU').length,'Opportunités perdues']].map(([value,text])=><article className="panel" key={text}><b>{value}</b><span>{text}</span></article>)}</div>
      <div className="commercial-insights">
        <section className="panel commercial-priorities"><h3><CalendarClock/>Sur qui se concentrer ?</h3><p className="muted">Priorité indicative : échéance de relance, étape et ancienneté du contact. Ce score n’est pas une probabilité de vente.</p>{priorities.slice(0,5).map(row=><button key={row.prospect.id} className="commercial-priority" onClick={()=>{setError('');setSelected(row.prospect)}}><span className="priority-score">{row.score}<small>/100</small></span><span><strong>{row.prospect.company}</strong><small>{row.reason}</small><span>{row.action}</span></span><ArrowRight/></button>)}{!priorities.length&&<p>Aucune opportunité ouverte. Ajoutez un prospect pour démarrer.</p>}</section>
        {canViewOffers&&<section className="panel commercial-offers"><h3><Target/>Quelles offres travailler ?</h3><p className="muted">Correspondances entre le besoin saisi et les mots du catalogue. À confirmer avec le prospect ; aucun chiffre d’affaires n’est estimé.</p>{offerError&&<p role="status">{offerError}</p>}{offers.slice(0,4).map(row=><article key={row.service.id}><strong>{row.service.name}</strong><small>{row.prospects.length} besoin(s) correspondant(s) · {row.overdue} relance(s) échue(s)</small><div>{row.prospects.slice(0,3).map(p=><button key={p.id} onClick={()=>setSelected(p)}>{p.company}<ArrowRight/></button>)}</div></article>)}{!offers.length&&!offerError&&<p>Aucune correspondance pour l’instant. Renseignez les besoins des prospects et votre catalogue de services.</p>}</section>}
      </div>
      <div className="commercial-toolbar"><label><Search/><input aria-label="Rechercher un prospect" placeholder="Entreprise, contact, besoin…" value={search} onChange={event=>setSearch(event.target.value)}/></label><label>Étape<select aria-label="Filtrer par étape" value={filter} onChange={event=>setFilter(event.target.value)}><option value="ALL">Toutes les étapes</option>{commercialStages.map(([stage,name])=><option key={stage} value={stage}>{name}</option>)}</select></label><span>{displayed.length} prospect(s)</span></div>
      <div className="commercial-board" aria-label="Étapes du pipeline">{commercialStages.map(([stage,name])=><section className="commercial-column" data-stage={stage} key={stage} onDragOver={event=>{if(rights.update&&!busy)event.preventDefault()}} onDrop={event=>{event.preventDefault();void move(event.dataTransfer.getData('text/plain'),stage)}}><header><i/><h3>{name}</h3><b>{displayed.filter(p=>p.stage===stage).length}</b></header>{displayed.filter(p=>p.stage===stage).map(p=><article className="commercial-card" key={p.id} draggable={rights.update&&!busy} onDragStart={event=>{event.dataTransfer.setData('text/plain',p.id);event.dataTransfer.effectAllowed='move'}}><button className="commercial-card-open" onClick={()=>{setError('');setSelected(p)}}><strong>{p.company}</strong><span>{p.contact_name||'Contact à renseigner'}</span><small>{p.need||'Besoin à qualifier'}</small><span className="commercial-stage-label">{name}</span></button>{isOpenProspect(p)&&<small>Relance : {dateLabel(p.next_follow_up_at)}</small>}{rights.update&&<label className="commercial-stage-control">Déplacer vers<select aria-label={`Étape de ${p.company}`} disabled={busy} value={p.stage} onChange={event=>void move(p.id,event.target.value)}>{commercialStages.map(([value,text])=><option value={value} key={value}>{text}</option>)}</select></label>}</article>)}{!displayed.some(p=>p.stage===stage)&&<p className="commercial-empty">Aucun prospect</p>}</section>)}</div>
      {displayed.some(p=>!commercialStages.some(([stage])=>stage===p.stage))&&<section className="panel"><h3>Étapes à réviser</h3>{displayed.filter(p=>!commercialStages.some(([stage])=>stage===p.stage)).map(p=><button className="secondary-btn" key={p.id} onClick={()=>setSelected(p)}>{p.company} · {p.stage}</button>)}</section>}
    </>}
    {selected&&<div className="commercial-modal-backdrop"><div ref={dialogRef} className="commercial-modal panel" role="dialog" aria-modal="true" aria-labelledby="prospect-title" tabIndex={-1}><header><h2 id="prospect-title">{selected.id?'Fiche prospect':'Nouveau prospect'}</h2><button className="secondary-btn" aria-label="Fermer la fiche prospect" disabled={busy} onClick={()=>setSelected(null)}><X/></button></header>
      <p className="muted">{writable?'Renseignez le besoin et la prochaine action pour un suivi exploitable.':'Lecture seule : la modification nécessite une autorisation.'}</p>
      {selected.id&&<div className="commercial-actions">{selected.phone&&<a className="secondary-btn" href={`tel:${selected.phone.replace(/[^+0-9]/g,'')}`}><Phone/>Appeler</a>}{selected.email&&<a className="secondary-btn" href={`mailto:${encodeURIComponent(selected.email)}`}><Mail/>Écrire un e-mail</a>}</div>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <form onSubmit={async event=>{
        event.preventDefault();if(!writable||lock.current)return
        const data=new FormData(event.currentTarget),text=(key:string)=>String(data.get(key)||'').trim(),iso=(key:string)=>text(key)?new Date(text(key)).toISOString():null
        lock.current=true;setBusy(true);setError('');setNotice('')
        try{const row=await saveCommercialProspect(tenantOwnerId,{company:text('company'),contact_name:text('contact_name'),phone:text('phone'),email:text('email'),whatsapp:text('whatsapp'),sector:text('sector'),source:text('source'),need:text('need'),notes:text('notes'),stage:text('stage'),last_contact_at:iso('last_contact_at'),next_follow_up_at:iso('next_follow_up_at'),sms_opt_in:data.has('sms_opt_in'),email_opt_in:data.has('email_opt_in'),marketing_opt_in:data.has('marketing_opt_in')},selected.id);replace(row);setSelected(null);setNotice('Prospect et suivi commercial enregistrés.')}catch(cause){setError(cause instanceof Error?cause.message:'Enregistrement impossible.')}finally{lock.current=false;setBusy(false)}
      }}><fieldset disabled={!writable||busy}><div className="commercial-form-grid">
        <label>Entreprise / prospect<input name="company" required defaultValue={selected.company||''}/></label><label>Nom du contact<input name="contact_name" defaultValue={selected.contact_name||''}/></label>
        <label>Téléphone<input name="phone" type="tel" defaultValue={selected.phone||''}/></label><label>E-mail<input name="email" type="email" defaultValue={selected.email||''}/></label>
        <label>WhatsApp<input name="whatsapp" type="tel" defaultValue={selected.whatsapp||''}/></label><label>Secteur<input name="sector" defaultValue={selected.sector||''}/></label>
        <label>Origine du prospect<input name="source" defaultValue={selected.source||''}/></label><label>Étape<select name="stage" defaultValue={selected.stage}>{!commercialStages.some(([stage])=>stage===selected.stage)&&<option value={selected.stage}>{selected.stage}</option>}{commercialStages.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
        <label>Dernier contact<input type="datetime-local" name="last_contact_at" defaultValue={localDate(selected.last_contact_at||null)}/></label><label>Prochaine relance<input type="datetime-local" name="next_follow_up_at" defaultValue={localDate(selected.next_follow_up_at||null)}/></label>
        <label className="wide">Besoin / offre à proposer<textarea name="need" rows={3} defaultValue={selected.need||''} placeholder="Ex. création de site web, community management…"/></label>
        <label className="wide">Notes et prochaine action<textarea name="notes" rows={3} defaultValue={selected.notes||''}/></label>
      </div><div className="commercial-consents"><label><input name="sms_opt_in" type="checkbox" defaultChecked={Boolean(selected.sms_opt_in)}/>Consentement SMS</label><label><input name="email_opt_in" type="checkbox" defaultChecked={Boolean(selected.email_opt_in)}/>Consentement e-mail</label><label><input name="marketing_opt_in" type="checkbox" defaultChecked={Boolean(selected.marketing_opt_in)}/>Consentement marketing</label></div><small className="muted">Ne cochez que les consentements effectivement recueillis. Aucun message n’est envoyé automatiquement.</small></fieldset>{writable&&<button className="primary-btn compact" disabled={busy}>{busy?'Enregistrement…':'Enregistrer le prospect'}</button>}</form>
    </div></div>}
  </section>
}
