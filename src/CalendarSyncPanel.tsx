import {useEffect,useState} from 'react';
import {calendarSyncAction,connectGoogleCalendar,resolveCalendarLink} from './services/repository';
type State={connection:{calendar_email:string;connected:boolean;sync_enabled:boolean;inbound_enabled:boolean}|null;links:{task_id:string;suppressed:boolean;conflict:{title:string;start:string}|null;error:string|null;tasks:{title:string}|null}[]};
export default function CalendarSyncPanel({onChanged}:{onChanged:()=>void}){
 const [state,setState]=useState<State|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const load=async()=>setState(await calendarSyncAction<State>('status'));
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 async function act(work:()=>Promise<unknown>){setBusy(true);setError('');setMessage('');try{await work();await load();onChanged();}catch(e){setError(e instanceof Error?e.message:'Action impossible');}finally{setBusy(false);}}
 return <section className="panel" style={{padding:'clamp(16px,3vw,28px)',minWidth:0}}>
  <h3>Mon Google Agenda</h3>
  <p>Chaque collaborateur connecte son propre agenda. Toutes les tâches auxquelles il est assigné peuvent être synchronisées.</p>
  {!state&&!error&&<p role="status">Vérification de la connexion…</p>}
  {state&&!state.connection?.connected&&<button className="primary-btn" disabled={busy} onClick={()=>void act(connectGoogleCalendar)}>Connecter Google Agenda</button>}
  {state?.connection?.connected&&<>
   <p style={{overflowWrap:'anywhere'}}>Connecté : {state.connection.calendar_email}</p>
   <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}>
    <button className="primary-btn" disabled={busy||!state.connection.sync_enabled} onClick={()=>void act(async()=>{const r=await calendarSyncAction<{synced:number;imported:number;conflicts:number;failed:number}>('sync');setMessage(`${r.synced} envoi(s), ${r.imported} mise(s) à jour reçue(s), ${r.conflicts} conflit(s), ${r.failed} erreur(s).`);})}>{busy?'Traitement…':'Synchroniser maintenant'}</button>
    <button disabled={busy} onClick={()=>void act(()=>calendarSyncAction('settings',{sync_enabled:!state.connection!.sync_enabled}))}>{state.connection.sync_enabled?'Mettre en pause':'Reprendre la synchronisation'}</button>
   </div>
   <label style={{display:'flex',gap:10,alignItems:'start',marginTop:16}}><input type="checkbox" checked={state.connection.inbound_enabled} disabled={busy} onChange={e=>void act(()=>calendarSyncAction('settings',{inbound_enabled:e.target.checked}))}/><span>Importer les changements de titre et d’horaire depuis Google, selon mes droits sur les tâches.</span></label>
   <p>Synchronisation automatique périodique. Retirer un événement de Google ne supprime jamais la tâche de l’équipe.</p>
   {state.links.filter(l=>l.suppressed||l.conflict||l.error).map(l=><article key={l.task_id} style={{border:'1px solid var(--border,#888)',borderRadius:12,padding:12,marginTop:12,overflowWrap:'anywhere'}}>
    <strong>{l.tasks?.title||'Tâche assignée'}</strong>
    {l.error&&<p>{l.error}</p>}
    {l.conflict&&<><p>Version Google : {l.conflict.title} — {new Date(l.conflict.start).toLocaleString()}</p><div style={{display:'flex',flexWrap:'wrap',gap:10}}><button disabled={busy} onClick={()=>void act(()=>resolveCalendarLink(l.task_id,'LOCAL'))}>Conserver Smartsell</button><button disabled={busy} onClick={()=>void act(()=>resolveCalendarLink(l.task_id,'GOOGLE'))}>Utiliser Google</button></div></>}
    {l.suppressed&&<><p>Événement retiré de votre agenda, tâche conservée dans Smartsell.</p><button disabled={busy} onClick={()=>void act(async()=>{await resolveCalendarLink(l.task_id,'RESTORE');await calendarSyncAction('sync');})}>Remettre dans mon agenda</button></>}
   </article>)}
  </>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
