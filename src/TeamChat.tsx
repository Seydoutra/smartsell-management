import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { listTeamChatMessages, sendTeamChatMessage } from './services/repository'
import { supabase } from './services/supabase'
import type { TeamChatMessage } from './types/models'
import './client-portal.css'

export default function TeamChat(){
  const [messages,setMessages]=useState<TeamChatMessage[]>([])
  const [draft,setDraft]=useState('')
  const [myId,setMyId]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const endRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{let active=true;void supabase?.auth.getUser().then(({data})=>{if(active)setMyId(data.user?.id||'')});const load=()=>listTeamChatMessages().then(rows=>{if(active)setMessages(rows)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Chat indisponible')});void load();const timer=window.setInterval(()=>void load(),15000);return()=>{active=false;window.clearInterval(timer)}},[])
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages.length])
  const send=async(event:FormEvent)=>{event.preventDefault();if(!draft.trim()||busy)return;setBusy(true);setError('');try{const message=await sendTeamChatMessage(draft);setMessages(current=>[...current,message]);setDraft('')}catch(reason){setError(reason instanceof Error?reason.message:'Envoi impossible')}finally{setBusy(false)}}
  return <section className="portal-conversation team-chat" aria-label="Chat de l’équipe"><div className="portal-conversation-head"><MessageCircle/><div><h2>Chat de l’équipe</h2><p>Échangez avec vos collaborateurs dans votre espace privé. Les clients n’ont pas accès à ce fil.</p></div></div>{error&&<p role="alert" className="portal-error">{error}</p>}<div className="portal-message-list" aria-live="polite">{messages.length?messages.map(item=><article key={item.id} className={item.sender_id===myId?'mine':''}><small>{item.profiles?.full_name||'Collaborateur'} · {new Date(item.created_at).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small><p>{item.body}</p></article>):<div className="portal-empty"><MessageCircle/><p>Aucun message pour le moment. Démarrez la conversation.</p></div>}<div ref={endRef}/></div><form className="portal-compose" onSubmit={send}><label htmlFor="team-chat-compose">Message à l’équipe</label><div><textarea id="team-chat-compose" value={draft} onChange={event=>setDraft(event.target.value)} maxLength={4000} rows={2} placeholder="Une information, une question, une décision à partager…"/><button type="submit" disabled={busy||!draft.trim()} aria-label="Envoyer à l’équipe"><Send/></button></div><small>{draft.length}/4 000 caractères</small></form></section>
}
