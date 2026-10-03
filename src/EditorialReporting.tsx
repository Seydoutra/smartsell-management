import type { CreativeApproval, EditorialItem } from './types/models'
import { statusTone } from './lib/statusTone'

const networks=['Facebook','Instagram','LinkedIn','TikTok','X / Twitter','YouTube','Site web']

export default function EditorialReporting({items,approvals,onSelect}:{items:EditorialItem[];approvals:CreativeApproval[];onSelect:(item:EditorialItem)=>void}){
  const published=items.filter(item=>item.status==='PUBLIE')
  const overdue=items.filter(item=>item.publish_at&&new Date(item.publish_at)<new Date()&&!['PUBLIE','REPORTE'].includes(item.status))
  const pending=items.filter(item=>item.status==='A_VALIDER')
  const approved=items.filter(item=>approvals.some(review=>review.editorial_item_id===item.id&&review.client_id===item.client_id&&review.status==='APPROUVE'))
  const upcoming=items.filter(item=>item.publish_at&&new Date(item.publish_at)>=new Date()&&item.status!=='PUBLIE').sort((a,b)=>String(a.publish_at).localeCompare(String(b.publish_at))).slice(0,5)
  return <div className="report-grid editorial-report-grid">
    <section className="panel report-panel"><h2>Suivi de diffusion</h2><div className="detail-line"><strong>Publications réalisées</strong><b>{published.length} / {items.length}</b></div><div className="detail-line"><strong>Taux de publication</strong><b>{items.length?Math.round(published.length/items.length*100):0}%</b></div><div className="detail-line"><strong>En attente de validation</strong><b>{pending.length}</b></div><div className="detail-line"><strong>Approuvées par le client</strong><b>{approved.length}</b></div><div className="detail-line"><strong>En retard</strong><b>{overdue.length}</b></div><div className="detail-line"><strong>Reportées</strong><b>{items.filter(item=>item.status==='REPORTE').length}</b></div></section>
    <section className="panel report-panel"><h2>Répartition par réseau</h2>{networks.map(network=>{const count=items.filter(item=>(item.platforms||[item.platform]).includes(network)).length;return <div className="detail-line" key={network}><strong>{network}</strong><span><i className="mini-progress"><b style={{width:`${items.length?count/items.length*100:0}%`}}/></i>{count} publication(s)</span></div>})}</section>
    <section className="panel report-panel"><h2>Prochaines publications</h2>{upcoming.length?upcoming.map(item=><button className="detail-line editorial-report-link" type="button" key={item.id} onClick={()=>onSelect(item)}><strong>{item.title}</strong><span>{new Date(item.publish_at!).toLocaleDateString('fr-FR')} · <b className={`status ${statusTone(item.status)}`}>{item.status.replaceAll('_',' ')}</b></span></button>):<p>Aucune publication à venir.</p>}</section>
    <section className="panel report-panel"><h2>Liens de publication</h2>{published.length?published.slice(-5).reverse().map(item=><div className="detail-line" key={item.id}><strong>{item.title}</strong>{item.published_url?<a href={item.published_url} target="_blank" rel="noreferrer">Voir le post ↗</a>:<span>Lien non renseigné</span>}</div>):<p>Aucune publication réalisée.</p>}</section>
  </div>
}
