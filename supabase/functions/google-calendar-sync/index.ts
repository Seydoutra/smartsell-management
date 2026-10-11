import { adminClient, authenticated, requireActions, handleOptions, edgeError, json } from '../_shared/http.ts';
import { createGoogleEvent, updateGoogleEvent, deleteGoogleEvent, getGoogleAccessToken, ownedEvent } from '../_shared/google-calendar.ts';
import { automatedRecipientEligible } from '../_shared/notificationEligibility.ts';
import { remoteChanged } from '../_shared/calendar-decision.ts';

Deno.serve(async(request)=>{
 const options=handleOptions(request);if(options)return options;
 try{
 const bearer=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 const operator=!!((Deno.env.get('CRON_SECRET')&&request.headers.get('x-cron-secret')===Deno.env.get('CRON_SECRET'))||(bearer&&bearer===Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')));
 const admin=adminClient();let profileId:string|null=null;
 if(!operator){const {user}=await authenticated(request);profileId=user.id;await requireActions(admin,profileId,['planning.sync']);}
 const body=await request.json().catch(()=>({}));
 if(!operator && body.action==='settings'){
  const changes:Record<string,boolean>={};
  for(const key of ['inbound_enabled','sync_enabled'])if(typeof body[key]==='boolean')changes[key]=body[key];
  if(!Object.keys(changes).length)return json(request,{error:'Réglage invalide'},400);
  const {error}=await admin.from('calendar_connections').update(changes).eq('profile_id',profileId).eq('connected',true);if(error)throw error;
  return json(request,{success:true});
 }
 if(!operator && body.action==='status'){
  const {data:connection,error}=await admin.from('calendar_connections').select('calendar_email,connected,sync_enabled,inbound_enabled').eq('profile_id',profileId).maybeSingle();if(error)throw error;
  const {data:profile,error:profileError}=await admin.from('profiles').select('tenant_owner_id').eq('id',profileId).single();if(profileError)throw profileError;
  const {data:links,error:linkError}=await admin.from('calendar_task_links').select('task_id,suppressed,conflict,error,tasks!inner(title)').eq('profile_id',profileId).eq('tasks.tenant_owner_id',profile.tenant_owner_id||profileId);if(linkError)throw linkError;
  return json(request,{connection,links});
 }
 if(!operator && body.action && body.action!=='sync')return json(request,{error:'Action invalide'},400);
 const params=new URL(request.url).searchParams;
 if(params.has('verify_profile_id')){
  if(!operator)return json(request,{error:'Non autorisé'},403);
  const id=params.get('verify_profile_id'),eventId=params.get('verify_event_id');
  if(!/^[0-9a-f-]{36}$/i.test(id||'')||(eventId&&!/^sm[0-9a-f]{32}$/.test(eventId)))return json(request,{error:'Identifiant invalide'},400);
  const {data:c}=await admin.from('calendar_connections').select('*').eq('profile_id',id).eq('connected',true).maybeSingle();if(!c)return json(request,{error:'Connexion indisponible'},404);
  const res=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.calendar_id||'primary')}/events${eventId?'/'+eventId:'?maxResults=1'}`,{headers:{authorization:`Bearer ${await getGoogleAccessToken(c)}`}});
  const e=await res.json();return json(request,eventId?{google_status:res.status,id:e.id,title:e.summary,start:e.start?.dateTime,status:e.status}:{verified:res.ok,google_status:res.status});
 }
 let deleted=0,deletionFailed=0,synced=0,imported=0,conflicts=0,failed=0;
 const tokens=new Map<string,string>();
 async function access(c:any){if(!tokens.has(c.profile_id))tokens.set(c.profile_id,await getGoogleAccessToken(c));return tokens.get(c.profile_id)!;}
 let deletionQuery=admin.from('calendar_event_deletions').select('*').is('completed_at',null).order('created_at').limit(100);
 if(profileId)deletionQuery=deletionQuery.eq('profile_id',profileId);
 const {data:deletions,error:deletionError}=await deletionQuery;if(deletionError)throw deletionError;
 for(const job of deletions||[])try{
  const {data:c}=await admin.from('calendar_connections').select('*').eq('profile_id',job.profile_id).eq('connected',true).eq('sync_enabled',true).maybeSingle();if(!c)continue;
  await deleteGoogleEvent(await access(c),job.calendar_id,job.event_id,job.task_id);
  const {error}=await admin.from('calendar_event_deletions').update({completed_at:new Date().toISOString(),error:null}).eq('id',job.id);if(error)throw error;deleted++;
 }catch(e){deletionFailed++;await admin.from('calendar_event_deletions').update({error:e instanceof Error?e.message:'Suppression impossible'}).eq('id',job.id);}
 const {data:links,error}=await admin.rpc('calendar_pending_links',{p_profile:profileId});if(error)throw error;
 for(const link of links||[])try{
  const task=link.task;
  if(!await automatedRecipientEligible(admin,link.profile_id,task.tenant_owner_id))continue;
  await requireActions(admin,link.profile_id,['planning.sync']);
  const {data:c}=await admin.from('calendar_connections').select('*').eq('profile_id',link.profile_id).eq('connected',true).eq('sync_enabled',true).maybeSingle();if(!c)continue;
  const token=await access(c),event={taskId:task.id,eventKey:link.event_key,title:task.title,description:task.description,start:task.due_at,reminderMinutes:Number(task.reminder_minutes??30)};
  let remote=link.event_id?await ownedEvent(token,link.calendar_id,link.event_id,task.id):null;
  if(link.event_id&&!remote){await admin.rpc('calendar_apply_remote',{p_task:task.id,p_profile:link.profile_id,p_revision:link.synced_revision,p_etag:null,p_title:null,p_start:null,p_deleted:true});continue;}
  // Compare with the last acknowledged snapshot, never another collaborator's private agenda.
  if(remote && c.inbound_enabled && remoteChanged(link.baseline,remote.data) && !(link.synced_revision===-1 && link.remote_etag===remote.data.etag)){
   const {data:decision,error:inboundError}=await admin.rpc('calendar_apply_remote',{p_task:task.id,p_profile:link.profile_id,p_revision:link.synced_revision,p_etag:remote.data.etag,p_title:remote.data.summary,p_start:remote.data.start?.dateTime||null,p_deleted:false});if(inboundError)throw inboundError;
   if(decision==='IMPORTED'){imported++;continue;}
   if(decision==='CONFLICT'){conflicts++;continue;}
   if(decision==='INVALID')throw new Error('Événement Google sans titre ou sans horaire : rétablissez un événement avec une heure précise');
   if(decision!=='UNCHANGED'&&decision!=='OUTBOUND')continue;
  }
  if(link.conflict){conflicts++;continue;}
  if(link.event_id && task.calendar_revision===link.synced_revision){await admin.from('calendar_task_links').update({checked_at:new Date().toISOString()}).eq('task_id',task.id).eq('profile_id',link.profile_id);continue;}
  const eventId=link.event_id?await updateGoogleEvent(token,link.calendar_id,link.event_id,event,remote?.data.etag):await createGoogleEvent(token,link.calendar_id,event);
  remote=await ownedEvent(token,link.calendar_id,eventId,task.id);
  if(!link.event_id && remote && remoteChanged({title:task.title,start:task.due_at},remote.data)){
   await updateGoogleEvent(token,link.calendar_id,eventId,event,remote.data.etag);
   remote=await ownedEvent(token,link.calendar_id,eventId,task.id);
  }
  const {data:ack,error:ackError}=await admin.rpc('calendar_ack_link',{p_task:task.id,p_profile:link.profile_id,p_key:link.event_key,p_revision:task.calendar_revision,p_event:eventId,p_etag:remote?.data.etag||null});if(ackError)throw ackError;if(ack)synced++;
 }catch(e){failed++;await admin.from('calendar_task_links').update({error:e instanceof Error?e.message:'Synchronisation impossible',checked_at:new Date().toISOString()}).eq('task_id',link.task_id).eq('profile_id',link.profile_id);}
 return json(request,{processed:links?.length||0,synced,imported,conflicts,failed,deleted,deletionFailed});
 }catch(e){return edgeError(request,e);}
});
