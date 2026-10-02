import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, CheckCircle2, Clock3, FileWarning, Gauge, ListChecks, Play, RefreshCw, Save, ShieldCheck, Sparkles, Target, XCircle } from 'lucide-react'
import { decideAutopilotAction, executeAutopilotAction, getAutopilotSettings, listAutopilotRuns, runAutopilot, saveAutopilotSettings } from './services/repository'
import type { AutopilotAction, AutopilotRun, AutopilotSettings } from './types/models'

const human=(value:string)=>value.replaceAll('_',' ').toLowerCase().replace(/^./,letter=>letter.toUpperCase())
const when=(value:string)=>new Date(value).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})
const emptySettings:AutopilotSettings={profile_id:'',enabled:true,mode:'COPILOTE',daily_briefing:true,max_actions_per_run:12,approval_threshold:'TOUJOURS',updated_at:new Date().toISOString()}

function ActionCard({action,onDecision,onExecute,onNavigate,busy}:{action:AutopilotAction;onDecision:(id:string,decision:'APPROVE'|'REJECT')=>void;onExecute:(id:string)=>void;onNavigate:(page:string)=>void;busy:string}){
  const result=action.result||{}
  return <article className={`autopilot-action ${action.priority.toLowerCase()} ${action.status.toLowerCase()}`}>
    <header><span>{action.category}</span><b>{human(action.priority)}</b></header>
    <h3>{action.title}</h3><p>{action.rationale}</p>
    <div className="autopilot-tags"><span>Risque {human(action.risk_level)}</span><span>{human(action.action_type)}</span></div>
    {typeof result.message==='string'&&<div className="autopilot-result"><strong>Brouillon prêt</strong><p>{result.message}</p></div>}
    {typeof result.detail==='string'&&<div className="autopilot-result"><p>{result.detail}</p></div>}
    <footer>
      {action.status==='A_VALIDER'&&<><button className="primary-btn compact" disabled={busy===action.id} onClick={()=>onDecision(action.id,'APPROVE')}><CheckCircle2/>Approuver</button><button className="danger-btn" disabled={busy===action.id} onClick={()=>onDecision(action.id,'REJECT')}><XCircle/>Rejeter</button></>}
      {action.status==='APPROUVEE'&&<button className="primary-btn compact" disabled={busy===action.id} onClick={()=>onExecute(action.id)}><Play/>Exécuter</button>}
      {action.status==='EXECUTEE'&&<button className="ghost-action" onClick={()=>onNavigate(action.target_page)}><Target/>Ouvrir {action.target_page}</button>}
      <em>{human(action.status)}</em>
    </footer>
  </article>
}

export function AutopilotPage({onNavigate}:{onNavigate:(page:string)=>void}){
  const[settings,setSettings]=useState<AutopilotSettings>(emptySettings),[runs,setRuns]=useState<AutopilotRun[]>([]),[loading,setLoading]=useState(true),[running,setRunning]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const autoStarted=useRef(false)
  const load=async()=>{setError('');try{const [config,history]=await Promise.all([getAutopilotSettings(),listAutopilotRuns()]);setSettings(config);setRuns(history);return{config,history}}catch(e){setError(e instanceof Error?e.message:'Autopilot indisponible');return null}finally{setLoading(false)}}
  const launch=async(silent=false)=>{setRunning(true);setError('');if(!silent)setNotice('');try{const{run}=await runAutopilot();setRuns(rows=>[run,...rows.filter(row=>row.id!==run.id)]);if(!silent)setNotice('Analyse terminée. Chaque action attend votre validation avant exécution.')}catch(e){setError(e instanceof Error?e.message:'Analyse impossible')}finally{setRunning(false)}}
  useEffect(()=>{void load().then(result=>{if(!result||autoStarted.current||!result.config.enabled||!result.config.daily_briefing)return;autoStarted.current=true;const today=new Date().toDateString(),hasToday=result.history.some(row=>new Date(row.started_at).toDateString()===today);if(!hasToday)void launch(true)})},[])
  const current=runs[0],actions=current?.autopilot_actions||[]
  const queue=useMemo(()=>actions.filter(action=>['A_VALIDER','APPROUVEE'].includes(action.status)),[actions])
  const refresh=async()=>{setLoading(true);await load()}
  const decide=async(id:string,decision:'APPROVE'|'REJECT')=>{setBusy(id);setError('');try{await decideAutopilotAction(id,decision);await refresh();setNotice(decision==='APPROVE'?'Action approuvée. Elle reste en attente de votre clic sur « Exécuter ».':'Action rejetée. Aucun changement n’a été effectué.')}catch(e){setError(e instanceof Error?e.message:'Décision impossible')}finally{setBusy('')}}
  const execute=async(id:string)=>{setBusy(id);setError('');try{await executeAutopilotAction(id);await refresh();setNotice('Action exécutée et ajoutée au journal d’audit.')}catch(e){setError(e instanceof Error?e.message:'Exécution impossible')}finally{setBusy('')}}
  const save=async()=>{setBusy('settings');setError('');try{const value=await saveAutopilotSettings({...settings,updated_at:new Date().toISOString()});setSettings(value);setNotice('Réglages Autopilot enregistrés.')}catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible')}finally{setBusy('')}}
  return <div className="innovation-page autopilot-page">
    <section className="innovation-hero autopilot-hero"><div><span className="eyebrow"><i/> SMARTSELL AUTOPILOT</span><h1>L’agence avance, vous gardez le dernier mot.</h1><p>Un chef d’orchestre intelligent détecte les urgences, prépare les prochaines actions et attend votre validation avant tout changement.</p></div><div className="autopilot-orb"><Bot/><strong>{queue.length}</strong><span>action(s) supervisée(s)</span></div></section>
    {error&&<div className="error-banner">{error}</div>}{notice&&<div className="success-banner">{notice}</div>}
    <section className="panel autopilot-controls"><div><span className="eyebrow"><i/> GARDE-FOUS</span><h2>Pilotage supervisé</h2><p>L’analyse peut être automatique. Les actions restent manuelles, traçables et révocables avant exécution.</p></div><label className="switch-card"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/><span>Autopilot actif</span></label><label>Mode<select value={settings.mode} onChange={e=>setSettings({...settings,mode:e.target.value as AutopilotSettings['mode']})}><option value="OBSERVATION">Observation</option><option value="COPILOTE">Copilote</option><option value="AUTOPILOTE">Autopilote supervisé</option></select></label><label>Actions maximum<input type="number" min="1" max="30" value={settings.max_actions_per_run} onChange={e=>setSettings({...settings,max_actions_per_run:Number(e.target.value)})}/></label><label className="switch-card"><input type="checkbox" checked={settings.daily_briefing} onChange={e=>setSettings({...settings,daily_briefing:e.target.checked})}/><span>Briefing quotidien</span></label><button className="ghost-action" disabled={busy==='settings'} onClick={()=>void save()}><Save/>Enregistrer</button><button className="primary-btn compact" disabled={running||!settings.enabled} onClick={()=>void launch()}><Sparkles/>{running?'Analyse…':'Lancer maintenant'}</button></section>
    {loading&&!current?<div className="innovation-loading"><RefreshCw/><strong>Préparation du briefing…</strong><span>Factures, tâches, projets et relances commerciales sont analysés.</span></div>:current&&<>
      <section className="autopilot-briefing panel"><div><span className="eyebrow"><i/> BRIEFING DE DIRECTION</span><h2>{current.summary}</h2><small>Dernière analyse : {when(current.started_at)}</small></div><ShieldCheck/><button className="icon-btn" title="Actualiser" onClick={()=>void refresh()}><RefreshCw/></button></section>
      <section className="autopilot-kpis"><article><FileWarning/><strong>{current.metrics.overdue_invoices}</strong><span>factures échues</span></article><article><ListChecks/><strong>{current.metrics.late_tasks}</strong><span>tâches en retard</span></article><article><Gauge/><strong>{current.metrics.stalled_projects}</strong><span>projets à relancer</span></article><article><Clock3/><strong>{current.metrics.followups_due}</strong><span>relances dues</span></article></section>
      <section className="panel autopilot-queue"><div className="section-title"><div><span className="eyebrow"><i/> FILE DE DÉCISION</span><h2>{queue.length?`${queue.length} action(s) requièrent votre attention`:'Tout est sous contrôle'}</h2></div><span className="autopilot-safe"><ShieldCheck/>Validation humaine obligatoire</span></div><div className="autopilot-actions">{actions.length?actions.map(action=><ActionCard key={action.id} action={action} onDecision={(id,decision)=>void decide(id,decision)} onExecute={id=>void execute(id)} onNavigate={onNavigate} busy={busy}/>):<div className="autopilot-empty"><CheckCircle2/><strong>Aucune action urgente</strong><span>L’Autopilot continuera de surveiller les signaux de l’agence.</span></div>}</div></section>
    </>}
    <section className="panel autopilot-history"><div className="section-title"><div><span className="eyebrow"><i/> MÉMOIRE DE DÉCISION</span><h2>Analyses précédentes</h2></div><b>{runs.length}</b></div>{runs.map(run=><button key={run.id} onClick={()=>setRuns(rows=>[run,...rows.filter(row=>row.id!==run.id)])}><span>{when(run.started_at)}</span><strong>{run.summary||'Analyse Smartsell Management'}</strong><small>{run.metrics?.total_actions||0} action(s) · {human(run.status)}</small></button>)}</section>
  </div>
}
