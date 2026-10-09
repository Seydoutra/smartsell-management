import {useState} from 'react'
import type {Profile} from './types/models'
import './team-profile-picker.css'
export default function TeamProfilePicker({profiles,name,selected=[]}:{profiles:Profile[];name:string;selected?:string[]}){
 const [search,setSearch]=useState(''),[ids,setIds]=useState(selected)
 const team=profiles.filter(p=>p.active&&!(p.roles?.length?p.roles:[p.role]).includes('CLIENT'))
 const chosen=ids.map(id=>team.find(p=>p.id===id)).filter((p):p is Profile=>Boolean(p))
 const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 const results=team.filter(p=>normalized(`${p.full_name} ${p.role}`).includes(normalized(search)))
 const toggle=(id:string)=>setIds(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id])
 return <div className="team-profile-picker">
  {chosen.map(p=><input key={p.id} type="hidden" name={name} value={p.id}/>)}
  <div className="team-picker-top"><span>Votre équipe uniquement</span><strong>{chosen.length} sélectionné{chosen.length>1?'s':''}</strong></div>
  <input type="search" aria-label="Rechercher un collaborateur" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un nom ou un rôle…"/>
  {chosen.length>0&&<div className="team-picker-chips">{chosen.map((p,index)=><button type="button" key={p.id} onClick={()=>toggle(p.id)} aria-label={`Retirer ${p.full_name}`}><span>{p.full_name}{index===0?' · Responsable':''}</span><span aria-hidden="true">×</span></button>)}</div>}
  <div className="team-picker-options" role="group" aria-label="Collaborateurs disponibles">{results.map(p=><button type="button" className={ids.includes(p.id)?'is-selected':''} key={p.id} aria-pressed={ids.includes(p.id)} onClick={()=>toggle(p.id)}>
   <span className="team-picker-avatar">{p.avatar_url?<img src={p.avatar_url} alt="" loading="lazy"/>:p.full_name.split(' ').map(word=>word[0]).slice(0,2).join('')}</span>
   <span className="team-picker-identity"><strong>{p.full_name}</strong><small>{(p.roles?.length?p.roles:[p.role]).map(role=>role.replaceAll('_',' ')).join(' · ')}</small></span><span className="team-picker-check" aria-hidden="true">{ids.includes(p.id)?'✓':'+'}</span>
  </button>)}</div>
  {!results.length&&<p>{team.length?'Aucun collaborateur correspondant.':'Aucun collaborateur actif dans votre entreprise.'}</p>}
  <small>Plusieurs profils peuvent être sélectionnés. Le premier est le responsable principal.</small>
 </div>
}
