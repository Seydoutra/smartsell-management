import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Mic, Square, X, CheckCircle2, WandSparkles } from 'lucide-react'
import { BillingCreateForm } from './AdvancedModulesV3'
import { commandKinds, commandLabels, commandPermission, exactCommandMatch, parseActionCommand, type CommandDraft, type CommandKind } from './lib/actionCommand'
import { loadCommandReferences, verifyCommandSession } from './services/actionCommandRepository'
import { createClient, createInvoice, createProject, createQuote, createTask } from './services/repository'
import { trackActivity } from './services/activityTracker'
import type { Client, Invoice, Profile, Project, Quote, Service } from './types/models'
import './action-command.css'

export interface BrowserRecognition {
  lang:string; continuous:boolean; interimResults:boolean;
  onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;
  onerror:((event:{error:string})=>void)|null; onend:(()=>void)|null;
  start:()=>void; stop:()=>void; abort:()=>void;
}
export function browserRecognitionConstructor(){
  const browser=window as unknown as {SpeechRecognition?:new()=>BrowserRecognition;webkitSpeechRecognition?:new()=>BrowserRecognition}
  return browser.SpeechRecognition||browser.webkitSpeechRecognition
}
const examples=[
  'Créer un client Alpha, email contact@exemple.com, téléphone +224620000000',
  'Créer une tâche Préparer les visuels, projet Campagne été, attribuer à Fatou, échéance 2026-12-10',
  'Créer un projet Campagne été, client Alpha, description Communication de décembre',
  'Créer une facture, client Alpha, service Community management, montant 700000 GNF, échéance 2026-12-10, sans TVA',
  'Créer un devis, client Alpha, service Création de site, montant 2000000 GNF, date 2026-12-10',
]
type References={clients:Client[];projects:Project[];profiles:Profile[];services:Service[]}
const emptyReferences:References={clients:[],projects:[],profiles:[],services:[]}
export default function ActionCommand({profile,allowed,blocked,onClose,onCreated}:{
  profile:Profile;allowed:(key:string)=>boolean;blocked:boolean;onClose:()=>void;
  onCreated:(kind:CommandKind)=>void;
}){
  const [text,setText]=useState(''),[draft,setDraft]=useState<CommandDraft|null>(null),[references,setReferences]=useState<References>(emptyReferences)
  const [clientId,setClientId]=useState(''),[projectId,setProjectId]=useState(''),[assigneeId,setAssigneeId]=useState('')
  const [busy,setBusy]=useState(false),[listening,setListening]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[success,setSuccess]=useState(''),[confirmed,setConfirmed]=useState(false)
  const dialog=useRef<HTMLDivElement>(null),recognition=useRef<BrowserRecognition|null>(null),lock=useRef(false),active=useRef(true)
  const tenant=profile.tenant_owner_id||profile.id
  const permitted=commandKinds.filter(kind=>allowed(commandPermission(kind)))
  const cancelListening=()=>{const current=recognition.current;recognition.current=null;if(current){current.onresult=null;current.onerror=null;current.onend=null;current.abort()}setListening(false)}
  useEffect(()=>{
    active.current=true
    const previous=document.activeElement as HTMLElement|null
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!lock.current){event.preventDefault();onClose()}
      if(event.key!=='Tab')return
      const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[])
      if(!items.length)return
      if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus()}
      else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus()}
    }
    document.addEventListener('keydown',keydown)
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden'
    return()=>{active.current=false;cancelListening();document.removeEventListener('keydown',keydown);document.body.style.overflow=overflow;previous?.focus()}
  },[]) // The dialog is remounted for each session; callbacks read current permission props below.
  useEffect(()=>{if(blocked){cancelListening();setError('Connexion requise et essai actif nécessaires pour enregistrer une action.')}},[blocked])
  const dictate=()=>{
    cancelListening();setError('');setDraft(null);setSuccess('');setConfirmed(false)
    const Constructor=browserRecognitionConstructor()
    if(!Constructor){setError('La dictée n’est pas disponible dans ce navigateur. Saisissez votre instruction ci-dessous ou utilisez le microphone du clavier.');return}
    try{
      const current=new Constructor();recognition.current=current
      current.lang='fr-FR';current.continuous=false;current.interimResults=false
      current.onresult=event=>{if(active.current&&recognition.current===current){setText(Array.from(event.results).map(result=>result[0].transcript).join(' '));setNotice('Vérifiez la transcription, puis préparez l’action.')}}
      current.onerror=event=>{if(active.current&&recognition.current===current)setError(event.error==='not-allowed'?'Autorisez le microphone dans les paramètres du navigateur, ou saisissez l’instruction.':event.error==='no-speech'?'Aucune parole détectée. Réessayez ou saisissez l’instruction.':'Dictée indisponible : vérifiez votre connexion ou saisissez l’instruction.')}
      current.onend=()=>{if(active.current&&recognition.current===current){recognition.current=null;setListening(false)}}
      current.start();setListening(true)
    }catch{cancelListening();setError('Impossible de démarrer le microphone. Vous pouvez saisir votre instruction.')}
  }
  const prepare=async()=>{
    if(lock.current||blocked)return
    cancelListening();setError('');setSuccess('');setNotice('');setConfirmed(false);setDraft(null)
    try{
      const parsed=parseActionCommand(text)
      if(!allowed(commandPermission(parsed.kind)))throw new Error('Vos droits ne permettent pas cette création.')
      lock.current=true;setBusy(true)
      const options=await loadCommandReferences(profile.id,tenant,parsed.kind,allowed)
      if(!active.current)return
      setReferences(options)
      setClientId(exactCommandMatch(parsed.clientName,options.clients,row=>row.name))
      setProjectId(exactCommandMatch(parsed.projectName,options.projects,row=>row.name))
      const canAssign=parsed.kind==='TASK'?allowed('tasks.assign'):allowed('projects.update')
      setAssigneeId(canAssign?exactCommandMatch(parsed.assigneeName,options.profiles,row=>row.full_name):parsed.kind==='TASK'?profile.id:'')
      if(parsed.assigneeName&&!canAssign)throw new Error('Vos droits ne permettent pas d’attribuer cette mission à un autre collaborateur.')
      const unresolved=[parsed.clientName&&!exactCommandMatch(parsed.clientName,options.clients,row=>row.name)?`Client « ${parsed.clientName} » à choisir`:null,parsed.projectName&&!exactCommandMatch(parsed.projectName,options.projects,row=>row.name)?`Projet « ${parsed.projectName} » à choisir`:null,parsed.assigneeName&&!exactCommandMatch(parsed.assigneeName,options.profiles,row=>row.full_name)?`Responsable « ${parsed.assigneeName} » à choisir`:null].filter(Boolean)
      setNotice(unresolved.length?`${unresolved.join(' · ')}. Aucun choix ambigu n’est fait automatiquement.`:'Vérifiez chaque champ avant de confirmer. Aucune donnée n’a encore été créée.')
      setDraft(parsed)
    }catch(cause){setError(cause instanceof Error?cause.message:'Préparation impossible.')}
    finally{lock.current=false;if(active.current)setBusy(false)}
  }
  const check=async(kind:CommandKind)=>{
    if(blocked||!allowed(commandPermission(kind)))throw new Error('Cette action n’est plus autorisée.')
    await verifyCommandSession(profile.id,tenant)
  }
  const completed=(kind:CommandKind,display:string)=>{
    trackActivity('Création confirmée par commande','Commande vocale',`${commandLabels[kind]} · ${display}`)
    setSuccess(`${commandLabels[kind]} créé${kind==='FACTURE'?'e':''} : ${display}. Rien n’a été envoyé au client.`);setDraft(null);setConfirmed(false);onCreated(kind)
  }
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(lock.current||!draft||!confirmed)return
    const values=new FormData(event.currentTarget)
    lock.current=true;setBusy(true);setError('')
    try{
      await check(draft.kind)
      const title=String(values.get('title')||'').trim(),description=String(values.get('description')||'').trim()
      if(!title)throw new Error('Renseignez le nom ou le titre.')
      if(draft.kind==='CLIENT'){
        const created=await createClient({name:title,email:String(values.get('email')||'').trim()||null,phone:String(values.get('phone')||'').trim()||null})
        completed(draft.kind,created.name)
      }else if(draft.kind==='PROJECT'){
        if(clientId&&!references.clients.some(row=>row.id===clientId))throw new Error('Client invalide.')
        if(assigneeId&&(!allowed('projects.update')||!references.profiles.some(row=>row.id===assigneeId)))throw new Error('Responsable non autorisé.')
        const created=await createProject({name:title,description:description||null,client_id:clientId||null,manager_id:assigneeId||null},assigneeId?[assigneeId]:[])
        completed(draft.kind,created.name)
      }else if(draft.kind==='TASK'){
        if(projectId&&!references.projects.some(row=>row.id===projectId))throw new Error('Projet invalide.')
        if(assigneeId!==profile.id&&assigneeId&&(!allowed('tasks.assign')||!references.profiles.some(row=>row.id===assigneeId)))throw new Error('Attribution non autorisée.')
        const date=String(values.get('date')||'')
        const created=await createTask({title,description:description||null,project_id:projectId||null,assignee_id:assigneeId||null,due_at:date?new Date(`${date}T17:00:00Z`).toISOString():null},assigneeId?[assigneeId]:[])
        completed(draft.kind,created.title)
      }
    }catch(cause){setError(`${cause instanceof Error?cause.message:'Création impossible.'} Si l’enregistrement a commencé, vérifiez la liste avant de réessayer pour éviter un doublon.`)}
    finally{lock.current=false;if(active.current)setBusy(false)}
  }
  const patch=(value:Partial<CommandDraft>)=>{setDraft(current=>current?{...current,...value}:null);setConfirmed(false)}
  const date=draft&&/^\d{4}-\d{2}-\d{2}$/.test(draft.date)?draft.date:''
  return <div className="command-overlay"><div ref={dialog} className="command-dialog" role="dialog" aria-modal="true" aria-labelledby="command-title">
    <div className="command-heading"><div><span className="eyebrow"><i/> ACTIONS ASSISTÉES</span><h2 id="command-title">Dicter une action</h2></div><button type="button" className="icon-btn" disabled={busy} onClick={onClose} aria-label="Fermer la commande vocale"><X/></button></div>
    <p className="command-explanation">Version sans clé IA : commandes simples, champs vérifiables et confirmation obligatoire. Pour les instructions libres complexes, nous connecterons l’agent IA ensuite.</p>
    <p className="command-privacy">Le microphone ne s’active qu’à votre demande. Selon le navigateur, la voix peut être traitée par son fournisseur et nécessite Internet ; Smartsell ne conserve pas votre audio.</p>
    {!permitted.length&&<p role="status">Aucune création n’est autorisée pour votre profil.</p>}
    <div className="command-input"><label htmlFor="command-text">Votre instruction</label><textarea id="command-text" value={text} maxLength={2000} disabled={busy||listening} placeholder="Créer un client Alpha, email contact@exemple.com, téléphone +224620000000" onChange={event=>{setText(event.target.value);setDraft(null);setConfirmed(false);setSuccess('')}}/><div className="command-controls"><button type="button" className="ghost-action" disabled={busy||blocked} onClick={listening?()=>recognition.current?.stop():dictate}>{listening?<Square/>:<Mic/>}{listening?'Arrêter la dictée':'Activer le microphone'}</button><button type="button" className="primary-btn compact" disabled={busy||blocked||listening||!text.trim()||!permitted.length} onClick={()=>void prepare()}><WandSparkles/>{busy?'Préparation…':'Préparer l’action'}</button></div></div>
    <details className="command-examples"><summary>Exemples de commandes prises en charge</summary>{examples.filter((_,index)=>permitted.includes(commandKinds[index])).map(example=><button type="button" key={example} disabled={busy||listening} onClick={()=>{setText(example);setDraft(null);setSuccess('');setConfirmed(false)}}>{example}</button>)}<p>Utilisez des chiffres pour les montants et la date AAAA-MM-JJ. Les noms doivent correspondre exactement ; sinon vous les sélectionnez vous-même.</p></details>
    {error&&<div className="error-banner" role="alert">{error}</div>}{notice&&<p className="command-notice" role="status">{notice}</p>}{success&&<div className="success-banner" role="status"><CheckCircle2/>{success}</div>}
    {draft&&allowed(commandPermission(draft.kind))&&!blocked&&<section className="command-preview"><h3>Aperçu — {commandLabels[draft.kind]}</h3>
      {draft.kind==='FACTURE'||draft.kind==='DEVIS'?<BillingCreateForm kind={draft.kind} clients={references.clients} projects={references.projects} services={references.services} clientFilter={clientId} requireConfirmation initialDraft={{date,currency:draft.currency,items:[{description:draft.service,quantity:1,unit_price:draft.amount??0,tax_rate:draft.taxRate}],taxEnabled:draft.taxRate>0}} create={async input=>{await check(input.kind);const common={client_id:input.clientId,project_id:input.projectId,currency:input.currency,discount:input.discount,items:input.items};return input.kind==='FACTURE'?createInvoice({...common,due_date:input.date}):createQuote({...common,valid_until:input.date})}} onCreated={(document:Invoice|Quote)=>completed(draft.kind,document.number)}/>:<form className="entity-form" onSubmit={event=>void submit(event)}>
        <fieldset disabled={busy}><div className="command-fields"><label>{draft.kind==='TASK'?'Titre de la tâche':'Nom'}<input name="title" required maxLength={200} value={draft.title} onChange={event=>patch({title:event.target.value})}/></label>
          {draft.kind==='CLIENT'?<><label>E-mail<input name="email" type="email" value={draft.email} onChange={event=>patch({email:event.target.value})}/></label><label>Téléphone<input name="phone" type="tel" value={draft.phone} onChange={event=>patch({phone:event.target.value})}/></label></>:<><label>Description<textarea name="description" value={draft.description} onChange={event=>patch({description:event.target.value})}/></label>
          {draft.kind==='PROJECT'?<label>Client<select required={Boolean(draft.clientName)} value={clientId} onChange={event=>{setClientId(event.target.value);setConfirmed(false)}}><option value="">Sans client</option>{references.clients.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>:<><label>Projet<select required={Boolean(draft.projectName)} value={projectId} onChange={event=>{setProjectId(event.target.value);setConfirmed(false)}}><option value="">Sans projet</option>{references.projects.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Échéance (17 h, heure de Conakry)<input name="date" type="date" value={date} onChange={event=>patch({date:event.target.value})}/></label></>}
          {((draft.kind==='TASK'&&allowed('tasks.assign'))||(draft.kind==='PROJECT'&&allowed('projects.update')))?<label>Responsable<select required={Boolean(draft.assigneeName)} value={assigneeId} onChange={event=>{setAssigneeId(event.target.value);setConfirmed(false)}}><option value="">Non attribué</option>{references.profiles.map(row=><option key={row.id} value={row.id}>{row.full_name}</option>)}</select></label>:draft.kind==='TASK'?<p>Attribution : vous-même ({profile.full_name}).</p>:null}</>}
        </div><label className="command-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>J’ai vérifié les champs et je confirme cette création.</label>{draft.kind!=='CLIENT'&&assigneeId&&<p className="command-privacy">Les notifications habituelles d’attribution restent actives.</p>}<button className="primary-btn compact" type="submit" disabled={!confirmed||busy}>{busy?'Enregistrement…':'Confirmer et créer'}</button></fieldset>
      </form>}
    </section>}
  </div></div>
}
