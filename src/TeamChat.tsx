import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { listProfiles, listTeamChatMessages, sendTeamChatMessage } from './services/repository'
import { supabase } from './services/supabase'
import type { Profile, TeamChatMessage } from './types/models'
import './client-portal.css'

type ChatScope = 'TEAM' | 'PRIVATE'

export default function TeamChat({onRead}:{onRead?:()=>void}){
  const [messages,setMessages]=useState<TeamChatMessage[]>([])
  const [profiles,setProfiles]=useState<Profile[]>([])
  const [draft,setDraft]=useState('')
  const [myId,setMyId]=useState('')
  const [scope,setScope]=useState<ChatScope>('TEAM')
  const [recipientId,setRecipientId]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const endRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    let active=true
    void supabase?.auth.getUser().then(({data})=>{if(active)setMyId(data.user?.id||'')})
    void listProfiles().then(rows=>{if(active)setProfiles(rows.filter(row=>row.active && row.role!=='CLIENT'))}).catch(()=>{})
    const load=()=>listTeamChatMessages().then(rows=>{if(active){setMessages(rows);onRead?.()}}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Chat indisponible')})
    void load()
    const timer=window.setInterval(()=>void load(),15000)
    return()=>{active=false;window.clearInterval(timer)}
  },[onRead])
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages.length,scope,recipientId])
  const visible=useMemo(()=>messages.filter(item=>scope==='TEAM' ? !item.recipient_id : Boolean(recipientId) && ((item.sender_id===myId&&item.recipient_id===recipientId)||(item.sender_id===recipientId&&item.recipient_id===myId))),[messages,scope,recipientId,myId])
  const recipient=profiles.find(row=>row.id===recipientId)
  const send=async(event:FormEvent)=>{
    event.preventDefault()
    if(!draft.trim()||busy||scope==='PRIVATE'&&!recipientId)return
    setBusy(true);setError('')
    try{
      const message=await sendTeamChatMessage(draft,scope==='PRIVATE'?recipientId:null)
      setMessages(current=>[...current,message]);setDraft('');onRead?.()
    }catch(reason){setError(reason instanceof Error?reason.message:'Envoi impossible')}
    finally{setBusy(false)}
  }
  return <section className="portal-conversation team-chat" aria-label="Messagerie de l’équipe">
    <div className="portal-conversation-head"><MessageCircle/><div><h2>Messages</h2><p>Discutez avec l’équipe ou choisissez un collaborateur pour un échange privé.</p></div></div>
    <div className="team-chat-scopes" role="group" aria-label="Type de conversation"><button type="button" className={scope==='TEAM'?'active':''} onClick={()=>setScope('TEAM')}>Équipe</button><button type="button" className={scope==='PRIVATE'?'active':''} onClick={()=>setScope('PRIVATE')}>Message privé</button></div>
    {scope==='PRIVATE'&&<label className="team-chat-recipient">Destinataire<select value={recipientId} onChange={event=>setRecipientId(event.target.value)}><option value="">Choisir un collaborateur…</option>{profiles.filter(row=>row.id!==myId).map(row=><option key={row.id} value={row.id}>@{row.full_name}</option>)}</select></label>}
    {scope==='PRIVATE'&&recipient&&<p className="team-chat-private-note">Seuls vous et {recipient.full_name} pouvez lire cette conversation.</p>}
    {error&&<p role="alert" className="portal-error">{error}</p>}
    <div className="portal-message-list" aria-live="polite">{visible.length?visible.map(item=><article key={item.id} className={item.sender_id===myId?'mine':''}><small>{item.profiles?.full_name||'Collaborateur'} · {new Date(item.created_at).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small><p>{item.body}</p></article>):<div className="portal-empty"><MessageCircle/><p>{scope==='PRIVATE'&&!recipientId?'Choisissez un collaborateur pour lui écrire.':'Aucun message pour le moment. Démarrez la conversation.'}</p></div>}<div ref={endRef}/></div>
    <form className="portal-compose" onSubmit={send}><label htmlFor="team-chat-compose">{scope==='PRIVATE'&&recipient?`Message privé à @${recipient.full_name}`:'Message à l’équipe'}</label><div><textarea id="team-chat-compose" value={draft} onChange={event=>setDraft(event.target.value)} maxLength={4000} rows={2} placeholder={scope==='PRIVATE'?'Écrivez un message que seul ce collaborateur pourra lire…':'Une information, une question, une décision à partager…'}/><button type="submit" disabled={busy||!draft.trim()||scope==='PRIVATE'&&!recipientId} aria-label="Envoyer le message"><Send/></button></div><small>{draft.length}/4 000 caractères</small></form>
  </section>
}
