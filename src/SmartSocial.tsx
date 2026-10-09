import { FormEvent, useCallback, useEffect, useState } from 'react'
import { BookOpenCheck, CalendarDays, ChartNoAxesCombined, ExternalLink, FileSpreadsheet, Link2, LoaderCircle, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react'
import type { Client, CreativeApproval, EditorialItem, Project, SocialIntegration } from './types/models'
import { allowedSocialViews, editorialStatuses, isSafeWebUrl, latestApproval, metricValue, publishedLinks, socialChannels, socialProviders, socialStatusLabel, socialViewLabels, type EditorialView, type SocialRights, type SocialView } from './lib/smartSocial'
import { statusTone } from './lib/statusTone'
import { createCreativeApproval, uploadEditorialAsset } from './services/repository'
import { deleteSocialEditorial, deleteSocialReference, importSocialEditorial, loadSocialConnections, loadSocialEditorial, saveSocialEditorial, saveSocialReference } from './services/smartSocialRepository'
import EditorialCalendar from './EditorialCalendar'
import EditorialPreparationTable from './EditorialPreparationTable'
import EditorialReporting from './EditorialReporting'
import EditorialImportPanel from './EditorialImportPanel'
import EditorialCanvaField from './EditorialCanvaField'
import CanvaIntegrationPanel from './CanvaIntegrationPanel'
import './smart-social.css'

const errorMessage=(cause:unknown)=>cause instanceof Error?cause.message:'Opération impossible. Réessayez.'
const noRights:SocialRights={view:false,create:false,update:false,delete:false}
const viewIcons={CALENDAR:CalendarDays,TABLE:FileSpreadsheet,BOARD:ShieldCheck,REPORT:ChartNoAxesCombined,CONNECTIONS:Link2}

export default function SmartSocial({tenantOwnerId,editorialRights=noRights,connectionRights=noRights,initialView='CALENDAR'}:{tenantOwnerId:string;editorialRights?:SocialRights;connectionRights?:SocialRights;initialView?:SocialView}) {
  const views=allowedSocialViews(editorialRights,connectionRights)
  const [requested,setRequested]=useState<SocialView>(views.includes(initialView)?initialView:views[0]||'CALENDAR')
  const view=views.includes(requested)?requested:views[0]
  if(!view)return <section className="panel empty-state">Vous n’avez pas accès à Smart Social.</section>
  return <section className="smart-social" aria-label="Smart Social">
    <header className="social-header"><div><span className="eyebrow"><i/> SMARTSELL MANAGEMENT</span><h1>Smart Social<span className="social-orbit" aria-hidden="true">✦</span></h1><p>Votre studio éditorial, dans votre espace de travail.</p></div><span className="social-header-label"><BookOpenCheck/>Préparer · Valider · Suivre</span></header>
    <nav className="social-tabs" aria-label="Vues Smart Social">{views.map(key=>{const Icon=viewIcons[key];return <button type="button" key={key} aria-current={view===key?'page':undefined} className={view===key?'active':''} onClick={()=>setRequested(key)}><Icon size={18}/>{socialViewLabels[key]}</button>})}</nav>
    {view==='CONNECTIONS'?<SocialConnections key={tenantOwnerId} tenantOwnerId={tenantOwnerId} rights={connectionRights}/>:<SocialEditorialStudio key={tenantOwnerId} tenantOwnerId={tenantOwnerId} rights={editorialRights} view={view}/ >}
  </section>
}

export function SocialEditorialStudio({tenantOwnerId,rights,view='CALENDAR'}:{tenantOwnerId:string;rights:SocialRights;view?:EditorialView}) {
  const [items,setItems]=useState<EditorialItem[]>([]),[approvals,setApprovals]=useState<CreativeApproval[]>([])
  const [clients,setClients]=useState<Client[]>([]),[projects,setProjects]=useState<Project[]>([])
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [clientFilter,setClientFilter]=useState('TOUS'),[network,setNetwork]=useState('TOUS'),[status,setStatus]=useState('TOUS'),[search,setSearch]=useState('')
  const [selected,setSelected]=useState<EditorialItem|null|undefined>()
  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try{const data=await loadSocialEditorial(tenantOwnerId);setItems(data.items);setApprovals(data.approvals);setClients(data.clients);setProjects(data.projects)}
    catch(cause){setItems([]);setApprovals([]);setClients([]);setProjects([]);setError(errorMessage(cause))}
    finally{setLoading(false)}
  },[tenantOwnerId])
  useEffect(()=>{if(rights.view)void load()},[load,rights.view])
  useEffect(()=>{if(!rights.view||(!rights.create&&selected===null))setSelected(undefined)},[rights.view,rights.create,selected])
  if(!rights.view)return null
  const filtered=items.filter(item=>(clientFilter==='TOUS'||(clientFilter==='INTERNE'?!item.client_id:item.client_id===clientFilter))
    &&(network==='TOUS'||(item.platforms?.length?item.platforms:[item.platform]).includes(network))
    &&(status==='TOUS'||item.status===status)&&`${item.title} ${item.caption||''} ${item.clients?.name||''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const counts=[['Contenus',filtered.length],['À valider',filtered.filter(item=>item.status==='A_VALIDER').length],['Planifiés',filtered.filter(item=>item.status==='PLANIFIE').length],['Publiés',filtered.filter(item=>item.status==='PUBLIE').length]] as const
  const select=(item:EditorialItem)=>{setError('');setNotice('');setSelected(item)}
  const requestApproval=async(item:EditorialItem)=>{
    if(!rights.update||busy||!item.client_id)return
    const review=latestApproval(item,approvals)
    if(review?.status==='A_VALIDER'&&item.status==='A_VALIDER'){setError('Une demande est déjà en attente chez ce client.');return}
    setBusy(true);setError('')
    try{
      await createCreativeApproval({client_id:item.client_id,editorial_item_id:item.id,title:item.title,
        description:[item.caption,item.hashtags,item.production_notes].filter(Boolean).join('\n\n'),asset_url:item.asset_urls?.[0]||null,asset_type:item.content_type||'CONTENU',version:(review?.version||0)+1})
      await saveSocialEditorial(tenantOwnerId,{...item,status:'A_VALIDER'},item.id)
      setSelected(undefined);setNotice('La création est disponible dans le portail client pour validation.');await load()
    }catch(cause){setError(errorMessage(cause))}finally{setBusy(false)}
  }
  return <>
    <div className="social-editorial-actions"><div><h2>{socialViewLabels[view]}</h2><p>{view==='REPORT'?'Suivi éditorial issu de vos contenus enregistrés, sans statistiques sociales simulées.':'Cliquez sur une publication pour consulter son contenu et sa validation.'}</p></div><div className="social-actions"><button type="button" className="ghost-action" disabled={loading||busy} onClick={()=>void load()} aria-label="Actualiser le calendrier"><RefreshCw size={16}/></button>{rights.create&&<><EditorialImportPanel clients={clients} projects={projects} existing={items} createBatch={rows=>importSocialEditorial(tenantOwnerId,rows)} onImported={count=>{setNotice(`${count} contenu(s) importé(s).`);void load()}}/><button type="button" className="primary-btn compact" disabled={loading||busy||Boolean(error)} onClick={()=>{setNotice('');setSelected(null)}}><Plus/>Nouvelle publication</button></>}</div></div>
    {error&&<div className="error-banner" role="alert">{error}</div>}{notice&&<div className="success-banner" role="status">{notice}</div>}
    {loading?<div className="social-loading" role="status"><LoaderCircle/>Chargement de votre studio…</div>:<>
      <div className="social-summary">{counts.map(([label,count])=><article className="panel" key={label}><span>{label}</span><strong>{count}</strong></article>)}</div>
      <div className="panel social-filters"><label>Rechercher<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Titre, texte ou client"/></label><label>Client<select value={clientFilter} onChange={event=>setClientFilter(event.target.value)}><option value="TOUS">Tous les clients</option><option value="INTERNE">Communication interne</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Réseau<select value={network} onChange={event=>setNetwork(event.target.value)}><option value="TOUS">Tous les réseaux</option>{socialChannels.map(channel=><option key={channel}>{channel}</option>)}</select></label><label>Statut<select value={status} onChange={event=>setStatus(event.target.value)}><option value="TOUS">Tous les statuts</option>{editorialStatuses.map(key=><option key={key} value={key}>{socialStatusLabel(key)}</option>)}</select></label></div>
      {view==='CALENDAR'&&<EditorialCalendar items={filtered} onSelect={select}/>}
      {view==='TABLE'&&<EditorialPreparationTable items={filtered} approvals={approvals} onSelect={select}/>}
      {view==='BOARD'&&<div className="social-workflow">{editorialStatuses.map(key=><section className="panel social-workflow-column" key={key}><h3><span data-status={key} className={`status ${statusTone(key)}`}>{socialStatusLabel(key)}</span><b>{filtered.filter(item=>item.status===key).length}</b></h3>{filtered.filter(item=>item.status===key).map(item=><button type="button" key={item.id} className="social-content-card" onClick={()=>select(item)}>{item.asset_urls?.[0]&&isSafeWebUrl(item.asset_urls[0])&&<img src={item.asset_urls[0]} alt="" loading="lazy"/>}<strong>{item.title}</strong><small>{item.clients?.name||'Communication interne'}</small><span>{(item.platforms?.length?item.platforms:[item.platform]).filter(Boolean).join(' · ')}</span></button>)}</section>)}</div>}
      {view==='REPORT'&&<EditorialReporting items={filtered} approvals={approvals} onSelect={select}/>}
    </>}
    {selected!==undefined&&<div className="modal-backdrop" onMouseDown={()=>!busy&&setSelected(undefined)}><section className="modal wide-modal social-content-modal" role="dialog" aria-modal="true" aria-label={selected?.title||'Nouvelle publication'} onMouseDown={event=>event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow"><i/> SMART SOCIAL</span><h2>{selected?.title||'Nouvelle publication'}</h2></div><button type="button" className="icon-btn" aria-label="Fermer la publication" disabled={busy} onClick={()=>setSelected(undefined)}><X/></button></div>
      {error&&<div className="error-banner" role="alert">{error}</div>}
      {selected&&!rights.update?<SocialContentPreview item={selected} approvals={approvals}/>:<SocialContentForm key={selected?.id||'new'} item={selected||undefined} clients={clients} projects={projects} busy={busy} onError={setError} onSubmit={async input=>{
        if(busy||(selected?!rights.update:!rights.create))return;setBusy(true);setError('')
        try{await saveSocialEditorial(tenantOwnerId,input,selected?.id);setSelected(undefined);setNotice('Publication enregistrée.');await load()}catch(cause){setError(errorMessage(cause))}finally{setBusy(false)}
      }}/>}
      {selected&&<div className="social-detail-actions">{rights.update&&selected.client_id&&<button type="button" className="ghost-action" disabled={busy} onClick={()=>void requestApproval(selected)}><ShieldCheck/>Envoyer la version enregistrée au client</button>}{rights.delete&&<button type="button" className="danger-btn" disabled={busy} onClick={async()=>{if(busy||!confirm('Supprimer cette publication ?'))return;setBusy(true);setError('');try{await deleteSocialEditorial(tenantOwnerId,selected.id);setSelected(undefined);setNotice('Publication supprimée.');await load()}catch(cause){setError(errorMessage(cause))}finally{setBusy(false)}}}>Supprimer</button>}</div>}
    </section></div>}
  </>
}

export function SocialContentPreview({item,approvals}:{item:EditorialItem;approvals:CreativeApproval[]}) {
  const review=latestApproval(item,approvals)
  return <div className="social-content-preview"><span data-status={item.status} className={`status ${statusTone(item.status)}`}>{socialStatusLabel(item.status)}</span><p>{item.clients?.name||'Communication interne'} · {(item.platforms?.length?item.platforms:[item.platform]).filter(Boolean).join(' · ')}</p><p>{item.publish_at?new Date(item.publish_at).toLocaleString('fr-FR'):'Date non définie'}</p><div className="social-preview-assets">{(item.asset_urls||[]).filter(isSafeWebUrl).map(url=><a key={url} href={url} target="_blank" rel="noreferrer">Ouvrir le visuel <ExternalLink size={14}/></a>)}</div><h3>Texte de la publication</h3><p className="social-caption">{item.caption||'Texte non renseigné'}</p>{item.hashtags&&<p>{item.hashtags}</p>}<p>Validation client : {review?`${review.status.replaceAll('_',' ')} · version ${review.version}`:'Pas encore envoyée'}</p>{publishedLinks(item).map(([name,url])=><a key={url} href={url} target="_blank" rel="noreferrer">{name} <ExternalLink size={14}/></a>)}<small>Lecture seule : les modifications ne sont pas autorisées sur ce profil.</small></div>
}

export function SocialContentForm({item,clients,projects,busy,onSubmit,onError}:{item?:EditorialItem;clients:Client[];projects:Project[];busy:boolean;onSubmit:(input:Partial<EditorialItem>)=>Promise<void>;onError:(message:string)=>void}) {
  const [clientId,setClientId]=useState(item?.client_id||''),[projectId,setProjectId]=useState(item?.project_id||'')
  const [assets,setAssets]=useState(item?.asset_urls||[]),[uploading,setUploading]=useState(false)
  const platforms=item?.platforms?.length?item.platforms:item?.platform?[item.platform]:['Instagram']
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy||uploading)return
    const form=new FormData(event.currentTarget),channels=form.getAll('platforms') as string[]
    if(!channels.length){onError('Choisissez au moins un réseau de diffusion.');return}
    const links=Object.fromEntries(socialChannels.map(channel=>[channel,String(form.get(`link_${channel}`)||'')]).filter(([,value])=>value))
    await onSubmit({title:String(form.get('title')),client_id:clientId||null,project_id:projectId||null,
      caption:String(form.get('caption')||''),platform:channels[0],platforms:channels,platform_links:links,asset_urls:assets,
      publish_at:form.get('publish_at')?new Date(String(form.get('publish_at'))).toISOString():null,status:String(form.get('status')),
      ...Object.fromEntries(['content_type','theme','post_type','objective','visual_title','visual_subtitle','hashtags','production_notes','week_label','canva_design_id','canva_design_title'].map(key=>[key,String(form.get(key)||'')]))})
  }
  const localDate=item?.publish_at?new Date(new Date(item.publish_at).getTime()-new Date(item.publish_at).getTimezoneOffset()*60_000).toISOString().slice(0,16):''
  return <form className="entity-form social-editorial-form" onSubmit={event=>void submit(event)}>
    <fieldset disabled={busy||uploading}><div className="form-grid">
      <label className="wide">Titre de la publication<input name="title" required maxLength={250} defaultValue={item?.title}/></label>
      <label>Client<select value={clientId} onChange={event=>{setClientId(event.target.value);setProjectId('')}}><option value="">Communication interne</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label>Projet<select value={projectId} onChange={event=>setProjectId(event.target.value)}><option value="">Sans projet</option>{projects.filter(project=>(project.client_id||'')===clientId).map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label>Date et heure<input name="publish_at" type="datetime-local" defaultValue={localDate}/></label>
      <label>Statut<select name="status" defaultValue={item?.status||'A_REDIGER'}>{editorialStatuses.map(status=><option key={status} value={status}>{socialStatusLabel(status)}</option>)}</select></label>
      <label>Format<input name="content_type" defaultValue={item?.content_type||''} placeholder="Reel, carrousel, image…"/></label>
      <label>Type de post<select name="post_type" defaultValue={item?.post_type||'Corporate'}>{['Corporate','Commercial','Sponsorisé','Portrait équipe','Audio-conseil','Autre'].map(type=><option key={type}>{type}</option>)}</select></label>
      <label>Thème<input name="theme" defaultValue={item?.theme||''}/></label><label>Semaine<input name="week_label" defaultValue={item?.week_label||''} placeholder="S1"/></label>
      <label className="wide">Objectif du post<input name="objective" defaultValue={item?.objective||''}/></label>
      <label>Titre du visuel<input name="visual_title" defaultValue={item?.visual_title||''}/></label><label>Sous-titre du visuel<input name="visual_subtitle" defaultValue={item?.visual_subtitle||''}/></label>
      <div className="wide"><strong>Réseaux de diffusion</strong><div className="platform-picker">{socialChannels.map(channel=><label key={channel}><input type="checkbox" name="platforms" value={channel} defaultChecked={platforms.includes(channel)}/><span>{channel}</span></label>)}</div></div>
      <label className="wide">Texte de la publication<textarea name="caption" rows={6} defaultValue={item?.caption||''} placeholder="Rédigez la légende destinée à votre audience…"/></label>
      <label className="wide">Hashtags<input name="hashtags" defaultValue={item?.hashtags||''}/></label>
      <label className="wide">Consignes de production<textarea name="production_notes" defaultValue={item?.production_notes||''}/></label>
      <div className="wide"><EditorialCanvaField item={item}/></div>
      <label className="wide">Visuels et fichiers<input type="file" accept="image/*,video/*" multiple onChange={async event=>{const files=Array.from(event.target.files||[]);event.target.value='';if(!files.length)return;setUploading(true);onError('');try{const urls=await Promise.all(files.map(uploadEditorialAsset));setAssets(current=>[...current,...urls])}catch(cause){onError(errorMessage(cause))}finally{setUploading(false)}}}/></label>
      {assets.length>0&&<div className="wide social-asset-list">{assets.map((url,index)=><div key={`${url}-${index}`}>{isSafeWebUrl(url)&&<a href={url} target="_blank" rel="noreferrer">Visuel {index+1} <ExternalLink size={14}/></a>}<button type="button" aria-label={`Retirer le visuel ${index+1}`} onClick={()=>setAssets(current=>current.filter((_,i)=>i!==index))}><X size={14}/></button></div>)}</div>}
      <div className="wide"><strong>Liens publiés par réseau</strong><div className="social-links-grid">{socialChannels.map(channel=><label key={channel}>{channel}<input name={`link_${channel}`} type="url" defaultValue={item?.platform_links?.[channel]||''} placeholder="https://…"/></label>)}</div></div>
    </div></fieldset><p className="muted">La planification organise votre travail dans Smartsell. Elle ne publie pas automatiquement sur un réseau social non connecté.</p><button type="submit" className="primary-btn compact" disabled={busy||uploading}>{uploading?'Téléversement…':busy?'Enregistrement…':'Enregistrer la publication'}</button>
  </form>
}

function SocialConnections({tenantOwnerId,rights}:{tenantOwnerId:string;rights:SocialRights}) {
  const [rows,setRows]=useState<SocialIntegration[]>([]),[clients,setClients]=useState<Client[]>([]),[filter,setFilter]=useState('TOUS')
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [editing,setEditing]=useState<SocialIntegration|null|undefined>()
  const load=useCallback(async()=>{setLoading(true);setError('');try{const data=await loadSocialConnections(tenantOwnerId);setRows(data.connections);setClients(data.clients)}catch(cause){setRows([]);setClients([]);setError(errorMessage(cause))}finally{setLoading(false)}},[tenantOwnerId])
  useEffect(()=>{if(rights.view)void load()},[load,rights.view])
  if(!rights.view)return null
  const displayed=rows.filter(row=>row.provider!=='CANVA'&&(filter==='TOUS'||(filter==='INTERNE'?!row.client_id:row.client_id===filter)))
  return <><div className="social-editorial-actions"><div><h2>Connexions & comptes clients</h2><p>Canva et vos références de pages, sans partager de mots de passe.</p></div><div className="social-actions"><button type="button" className="ghost-action" disabled={loading||busy} onClick={()=>void load()}><RefreshCw size={16}/>Actualiser</button>{rights.create&&<button type="button" className="primary-btn compact" disabled={loading||Boolean(error)} onClick={()=>setEditing(null)}><Plus/>Ajouter une page</button>}</div></div>{error&&<p className="error-banner" role="alert">{error}</p>}{notice&&<p className="success-banner" role="status">{notice}</p>}
    <CanvaIntegrationPanel canManage={rights.update}/>
    <p className="social-connection-note">Enregistrer une page ne l’autorise pas auprès de son réseau. La publication automatique et les statistiques en direct nécessitent un connecteur OAuth configuré côté serveur. Aucun chiffre n’est simulé.</p>
    <label className="social-client-filter">Client<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="TOUS">Tous les clients</option><option value="INTERNE">Communication interne</option>{clients.map(client=><option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
    {loading?<p className="social-loading" role="status"><LoaderCircle/>Chargement des comptes…</p>:<div className="social-connections-grid">{socialProviders.map(provider=>{const accounts=displayed.filter(row=>row.provider===provider.id);return <section key={provider.id} className="panel social-network-card"><header><span className={`integration-logo integration-${provider.id.toLowerCase()}`}>{provider.name.slice(0,1)}</span><div><h3>{provider.name}</h3><small>{accounts.length} page(s) référencée(s)</small></div></header>{accounts.length?accounts.map(row=><article className="social-account" key={row.id}><div><strong>{row.account_name||'Page sans nom'}</strong><small>{clients.find(client=>client.id===row.client_id)?.name||'Communication interne'}</small></div><span className={`status ${statusTone(row.status==='NON_CONFIGURE'?'A_CONFIGURER':row.status)}`}>{socialStatusLabel(row.status)}</span><div className="social-account-metrics"><span>Abonnés <b>{metricValue(row,'followers')??'—'}</b></span><span>Engagement <b>{metricValue(row,'engagement_rate')===null?'—':`${metricValue(row,'engagement_rate')} %`}</b></span></div>{row.last_synced_at&&row.status==='CONNECTE'&&<small>Dernière synchronisation : {new Date(row.last_synced_at).toLocaleString('fr-FR')}</small>}<div className="social-account-actions">{row.account_url&&isSafeWebUrl(row.account_url)&&<a href={row.account_url} target="_blank" rel="noreferrer">Ouvrir la page <ExternalLink size={14}/></a>}{rights.update&&row.status==='NON_CONFIGURE'&&<button type="button" onClick={()=>setEditing(row)}>Modifier</button>}{rights.delete&&row.status==='NON_CONFIGURE'&&<button type="button" disabled={busy} onClick={async()=>{if(!confirm('Supprimer cette référence de page ? Aucun compte social ne sera supprimé.'))return;setBusy(true);try{await deleteSocialReference(tenantOwnerId,row.id);setNotice('Référence supprimée.');await load()}catch(cause){setError(errorMessage(cause))}finally{setBusy(false)}}}>Supprimer</button>}</div></article>):<p className="muted">Aucune page pour cette sélection.</p>}</section>})}</div>}
    {editing!==undefined&&<div className="modal-backdrop"><section className="modal social-content-modal" role="dialog" aria-modal="true" aria-label="Référence de page"><div className="modal-head"><h2>{editing?'Modifier la page':'Ajouter une page'}</h2><button type="button" className="icon-btn" disabled={busy} onClick={()=>setEditing(undefined)} aria-label="Fermer"><X/></button></div>{error&&<p className="error-banner" role="alert">{error}</p>}<form className="entity-form" onSubmit={async event=>{event.preventDefault();if(busy||(editing?!rights.update:!rights.create))return;const f=new FormData(event.currentTarget);setBusy(true);setError('');try{await saveSocialReference(tenantOwnerId,{id:editing?.id,provider:String(f.get('provider')) as SocialIntegration['provider'],client_id:String(f.get('client_id')||'')||null,account_name:String(f.get('name')),account_url:String(f.get('url')||'')||null});setEditing(undefined);setNotice('Référence enregistrée. L’autorisation OAuth reste distincte.');await load()}catch(cause){setError(errorMessage(cause))}finally{setBusy(false)}}}><fieldset disabled={busy}><label>Réseau<select name="provider" defaultValue={editing?.provider||'FACEBOOK'}>{socialProviders.map(provider=><option value={provider.id} key={provider.id}>{provider.name}</option>)}</select></label><label>Client<select name="client_id" defaultValue={editing?.client_id||''}><option value="">Communication interne</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Nom de la page<input name="name" required defaultValue={editing?.account_name||''}/></label><label>URL publique<input name="url" type="url" defaultValue={editing?.account_url||''}/></label></fieldset><p>Aucun mot de passe ni clé API ne doit être saisi ici.</p><button className="primary-btn compact" disabled={busy}>{busy?'Enregistrement…':'Enregistrer la référence'}</button></form></section></div>}
  </>
}
