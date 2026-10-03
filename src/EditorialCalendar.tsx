import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { EditorialItem } from './types/models'
import { statusTone } from './lib/statusTone'
import './editorial-calendar.css'

const days=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
const dayKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const dateOf=(item:EditorialItem)=>item.publish_at?new Date(item.publish_at):null

export default function EditorialCalendar({items,onSelect}:{items:EditorialItem[];onSelect:(item:EditorialItem)=>void}){
  const [anchor,setAnchor]=useState(()=>{const next=items.map(dateOf).filter((date):date is Date=>!!date&&!Number.isNaN(date.getTime())).sort((a,b)=>a.getTime()-b.getTime())[0];return next?new Date(next.getFullYear(),next.getMonth(),1):new Date(new Date().getFullYear(),new Date().getMonth(),1)})
  const [view,setView]=useState<'MONTH'|'WEEK'>('MONTH')
  const start=useMemo(()=>{const date=new Date(anchor.getFullYear(),anchor.getMonth(),view==='MONTH'?1:anchor.getDate());date.setDate(date.getDate()-(date.getDay()+6)%7);return date},[anchor,view])
  const cells=useMemo(()=>Array.from({length:view==='MONTH'?42:7},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date}),[start,view])
  const byDay=useMemo(()=>{const map=new Map<string,EditorialItem[]>();for(const item of items){const date=dateOf(item);if(!date||Number.isNaN(date.getTime()))continue;const key=dayKey(date);map.set(key,[...(map.get(key)||[]),item])}return map},[items])
  const move=(amount:number)=>setAnchor(current=>view==='MONTH'?new Date(current.getFullYear(),current.getMonth()+amount,1):new Date(current.getFullYear(),current.getMonth(),current.getDate()+amount*7))
  return <section className="panel editorial-month-calendar" aria-label="Calendrier des publications">
    <div className="editorial-calendar-toolbar"><div><span className="eyebrow"><i/> PLANNING DE PUBLICATION</span><h2>{anchor.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</h2></div><div className="editorial-calendar-controls"><div className="segmented"><button type="button" className={view==='MONTH'?'active':''} onClick={()=>setView('MONTH')}>Mois</button><button type="button" className={view==='WEEK'?'active':''} onClick={()=>setView('WEEK')}>Semaine</button></div><button type="button" className="icon-btn" aria-label="Période précédente" onClick={()=>move(-1)}><ChevronLeft/></button><button type="button" className="icon-btn" aria-label="Période suivante" onClick={()=>move(1)}><ChevronRight/></button></div></div>
    <div className="editorial-calendar-days">{days.map(day=><strong key={day}>{day}</strong>)}</div>
    <div className={`editorial-calendar-cells ${view==='WEEK'?'week':''}`}>{cells.map(date=>{const key=dayKey(date),entries=byDay.get(key)||[];return <div className={`editorial-calendar-day ${date.getMonth()!==anchor.getMonth()&&view==='MONTH'?'outside':''}`} key={key}><time dateTime={key}>{date.getDate()}</time><div className="editorial-calendar-posts">{entries.map(item=><button type="button" key={item.id} className={`editorial-calendar-post ${statusTone(item.status)}`} onClick={()=>onSelect(item)} title={`${item.title} — ${item.clients?.name||'Client non renseigné'}`}><span>{dateOf(item)?.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span><strong>{item.title}</strong><small>{item.clients?.name||'—'}</small></button>)}</div></div>})}</div>
    <p className="editorial-calendar-note">Cliquez sur une publication pour consulter son contenu complet, ses consignes et ses visuels.</p>
  </section>
}
