import { useEffect, useState } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import type { ModuleIntent } from './lib/commercialPipeline'
import './commercialPipeline.css'

export type ModuleLink={label:string;view:string;action?:string;allowed:boolean}
export default function ModuleNavigation({name,icon:Icon,active,intent,links,onNavigate,notificationCount=0}:{name:string;icon:LucideIcon;active:boolean;intent:ModuleIntent;links:ModuleLink[];onNavigate:(intent:ModuleIntent)=>void;notificationCount?:number}) {
  const [expanded,setExpanded]=useState(active)
  useEffect(()=>{if(active)setExpanded(true)},[active])
  const permitted=links.filter(link=>link.allowed)
  const id=`module-${name.toLowerCase().replace(/[^a-z]/g,'')}`
  return <div className="nav-module">
    <button className={`nav-module-toggle ${active?'active':''}`} aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(value=>!value)}><Icon/><span>{name}</span>{notificationCount>0&&<b className="nav-alert-badge">{notificationCount>99?'99+':notificationCount}</b>}<ChevronDown className={expanded?'rotated':''}/></button>
    {expanded&&<div className="nav-submenu" id={id}>{permitted.map(link=><button key={link.label} className={active&&(intent.view||permitted[0]?.view)===link.view&&(intent.action||'')===(link.action||'')?'active':''} onClick={()=>onNavigate({view:link.view,action:link.action,request:link.action?crypto.randomUUID():undefined})}>{link.label}</button>)}</div>}
  </div>
}
