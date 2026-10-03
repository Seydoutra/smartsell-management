import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, LifeBuoy, MessageSquareText, Plus, RefreshCw } from 'lucide-react'
import { closeSupportTicket, createSupportTicket, listProfiles, listSupportMessages, listSupportTickets, sendSupportMessage } from './services/repository'
import type { Profile, SupportMessage, SupportTicket } from './types/models'
import './support-center.css'

const statusLabel:Record<SupportTicket['status'],string>={OPEN:'Ouvert',AWAITING_PLATFORM:'En attente de Smartsell',REPLIED_BY_PLATFORM:'Réponse de Smartsell',CLOSED:'Clôturé'}
const date=(value:string)=>new Date(value).toLocaleString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})

export default function SupportCenter({profile}:{profile:Profile}){
  const[tickets,setTickets]=useState<SupportTicket[]>([]),[people,setPeople]=useState<Profile[]>([])
  const[selectedId,setSelectedId]=useState<string|null>(null),[messages,setMessages]=useState<SupportMessage[]>([])
  const[creating,setCreating]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true)
  const[error,setError]=useState(''),[notice,setNotice]=useState('')
  const platformOwner=profile.is_platform_owner===true
  const selected=useMemo(()=>tickets.find(item=>item.id===selectedId)||null,[tickets,selectedId])
  const person=(id:string)=>people.find(item=>item.id===id)?.full_name||'Équipe Smartsell'
  const refresh=async()=>{
    try{const[rows,profiles]=await Promise.all([listSupportTickets(),listProfiles()]);setTickets(rows);setPeople(profiles);setError('')}
    catch(cause){setError(cause instanceof Error?cause.message:'Impossible de charger les demandes.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),30_000);return()=>window.clearInterval(timer)},[])
  useEffect(()=>{if(!selectedId){setMessages([]);return}void listSupportMessages(selectedId).then(setMessages).catch(cause=>setError(cause instanceof Error?cause.message:'Messages indisponibles.'))},[selectedId,tickets.find(item=>item.id===selectedId)?.updated_at])
  const create=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy)return
    setBusy(true);setError('');setNotice('')
    const values=new FormData(event.currentTarget)
    try{
      const id=await createSupportTicket({subject:String(values.get('subject')||''),body:String(values.get('body')||''),pageUrl:String(values.get('page_url')||'')})
      await refresh();setSelectedId(id);setCreating(false);setNotice('Votre demande est envoyée à l’assistance Smartsell.')
    }catch(cause){setError(cause instanceof Error?cause.message:'Envoi impossible.')}
    finally{setBusy(false)}
  }
  const reply=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy||!selectedId)return
    setBusy(true);setError('');setNotice('')
    const form=event.currentTarget,body=String(new FormData(form).get('body')||'')
    try{await sendSupportMessage(selectedId,body);form.reset();await refresh();setMessages(await listSupportMessages(selectedId));setNotice('Réponse envoyée.')}
    catch(cause){setError(cause instanceof Error?cause.message:'Réponse non envoyée.')}
    finally{setBusy(false)}
  }
  const close=async()=>{
    if(!selectedId||busy)return
    setBusy(true);setError('')
    try{await closeSupportTicket(selectedId);await refresh();setNotice('Demande clôturée. Vous pouvez la rouvrir en envoyant un message.')}
    catch(cause){setError(cause instanceof Error?cause.message:'Clôture impossible.')}
    finally{setBusy(false)}
  }
  return <section className="support-center">
    <header className="support-hero"><span><LifeBuoy/> ASSISTANCE SMARTSELL</span><h1>{platformOwner?'Demandes des utilisateurs':'Nous sommes à votre écoute.'}</h1><p>{platformOwner?'Les signalements des espaces SaaS arrivent ici. Répondez à chaque équipe dans un fil privé.':'Signalez une difficulté, collez un message d’erreur et échangez directement avec l’équipe Smartsell.'}</p><button type="button" onClick={()=>{setCreating(value=>!value);setSelectedId(null);setError('')}}><Plus/> Nouvelle demande</button></header>
    {error&&<p className="error-banner" role="alert">{error}</p>}{notice&&<p className="success-banner" role="status">{notice}</p>}
    {creating&&<form className="panel support-create" onSubmit={create}><h2>Décrire le problème</h2><div className="form-grid"><label>Objet<input name="subject" minLength={3} maxLength={160} required placeholder="Ex. Erreur lors de la création d’une facture"/></label><label>Page concernée<input name="page_url" maxLength={500} defaultValue={`${location.pathname}${location.hash.split('?')[0]}`} placeholder="Module ou adresse de la page"/></label></div><label>Message et texte exact de l’erreur<textarea name="body" required maxLength={5000} rows={6} placeholder="Expliquez ce que vous avez tenté, ce qui s’est passé et collez le message d’erreur. Évitez les mots de passe et les clés API."/></label><div className="support-form-actions"><button type="button" onClick={()=>setCreating(false)}>Annuler</button><button className="primary-btn" disabled={busy}><ArrowRight/>{busy?'Envoi…':'Envoyer à l’assistance'}</button></div></form>}
    <div className="support-layout"><aside className="panel support-list"><div className="support-list-head"><h2>{platformOwner?'Toutes les demandes':'Mes demandes'}</h2><button type="button" aria-label="Actualiser les demandes" onClick={()=>void refresh()}><RefreshCw/></button></div>{loading?<p>Chargement…</p>:tickets.length?tickets.map(ticket=><button type="button" key={ticket.id} className={selectedId===ticket.id?'selected':''} onClick={()=>{setSelectedId(ticket.id);setCreating(false);setNotice('')}}><strong>{ticket.subject}</strong><small>{platformOwner?`${person(ticket.tenant_owner_id)} · `:''}{date(ticket.updated_at)}</small><em className={`support-status ${ticket.status.toLowerCase()}`}>{statusLabel[ticket.status]}</em></button>):<div className="support-empty"><MessageSquareText/><p>Aucune demande pour le moment.</p></div>}</aside>
      <article className="panel support-thread">{selected?<><div className="support-thread-header"><div><span className={`support-status ${selected.status.toLowerCase()}`}>{statusLabel[selected.status]}</span><h2>{selected.subject}</h2><p>Créée par {person(selected.created_by)} le {date(selected.created_at)}{selected.page_url?` · ${selected.page_url}`:''}</p></div><button type="button" onClick={()=>void close()} disabled={busy||selected.status==='CLOSED'}><CheckCircle2/> Clôturer</button></div><div className="support-messages">{messages.map(message=><div key={message.id} className={`support-message ${message.author_id===profile.id?'mine':''}`}><strong>{message.author_id===profile.id?'Vous':person(message.author_id)}{people.find(p=>p.id===message.author_id)?.is_platform_owner?' · Smartsell':''}</strong><p>{message.body}</p><time>{date(message.created_at)}</time></div>)}</div><form className="support-reply" onSubmit={reply}><label>Votre réponse<textarea name="body" required maxLength={5000} rows={3} placeholder="Écrivez votre réponse…"/></label><button type="submit" className="primary-btn" disabled={busy}><ArrowRight/>{busy?'Envoi…':'Répondre'}</button></form></>:<div className="support-thread-empty"><LifeBuoy/><h2>Un canal direct avec Smartsell</h2><p>Sélectionnez une demande ou créez-en une nouvelle. Les autres entreprises ne peuvent pas voir vos échanges.</p></div>}</article></div>
  </section>
}
