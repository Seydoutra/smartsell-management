import { useMemo, useState } from 'react'
import { quickMessageMetrics } from './lib/quickMessageMetrics'
import type { QuickMessageLog } from './services/repository'
import './quick-message-dashboard.css'

const statusLabel=(status:string)=>({SENT:'Accepté',DELIVERED:'Livré',QUEUED:'En attente',FAILED:'Échec'}[status]||status)
const recipientLabel=(value:string)=>value.includes('@')?value.replace(/^(.{2}).*(@.*)$/,'$1•••$2'):value.replace(/.(?=.{4})/g,'•')

export default function QuickMessageDashboard({logs,loading,error,onRefresh}:{logs:QuickMessageLog[];loading:boolean;error:string;onRefresh:()=>void}){
  const [channel,setChannel]=useState<'ALL'|'SMS'|'EMAIL'>('ALL')
  const metrics=useMemo(()=>quickMessageMetrics(logs,channel),[logs,channel])
  const max=Math.max(1,...metrics.days.map(day=>day.count))
  return <section className="quick-message-dashboard" aria-label="Tableau de bord des messages simples">
    <div className="quick-message-head"><div><span className="eyebrow"><i/> ENVOIS DIRECTS</span><h2>Tableau de bord des messages</h2><p>Vos SMS et e-mails envoyés hors campagnes · 30 derniers jours</p></div><div className="quick-message-controls"><div className="segmented"><button type="button" className={channel==='ALL'?'active':''} onClick={()=>setChannel('ALL')}>Tous</button><button type="button" className={channel==='SMS'?'active':''} onClick={()=>setChannel('SMS')}>SMS</button><button type="button" className={channel==='EMAIL'?'active':''} onClick={()=>setChannel('EMAIL')}>E-mails</button></div><button type="button" className="ghost-action" onClick={onRefresh} disabled={loading}>Actualiser</button></div></div>
    {error&&<p className="quick-message-error" role="alert">Statistiques indisponibles : {error}</p>}
    <div className="quick-message-kpis"><div><small>Destinataires</small><strong>{metrics.selected.length}</strong></div><div><small>Acceptés par le fournisseur</small><strong>{metrics.accepted}</strong></div><div><small>En attente / test</small><strong>{metrics.pending}</strong></div><div><small>Échecs enregistrés</small><strong>{metrics.failed}</strong></div></div>
    <div className="quick-message-detail"><div className="panel quick-message-chart"><h3>Volume quotidien · 7 jours</h3><div className="quick-message-bars">{metrics.days.map(day=><div key={day.date}><b>{day.count}</b><span style={{height:`${Math.max(day.count?5:2,day.count/max*100)}%`}}/><small>{day.date}</small></div>)}</div></div><div className="panel quick-message-recent"><h3>Derniers destinataires</h3>{metrics.selected.slice(0,5).map(log=><div key={log.id}><span><strong>{log.channel}</strong> {recipientLabel(log.recipient)}<small>{new Date(log.sent_at).toLocaleString('fr-FR')}</small></span><b className={`quick-message-status quick-message-status-${log.status.toLowerCase()}`}>{statusLabel(log.status)}</b></div>)}{!metrics.selected.length&&<p>{loading?'Chargement…':'Aucun message simple enregistré.'}</p>}</div></div>
    <p className="quick-message-note">« Accepté » confirme la prise en charge par le fournisseur, pas la réception sur le téléphone ou dans la boîte mail. Statistiques limitées aux 1 000 derniers destinataires sur 30 jours.</p>
  </section>
}
