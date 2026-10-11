import { adminClient, json } from "../_shared/http.ts";
import { createGoogleEvent, updateGoogleEvent, deleteGoogleEvent, getGoogleAccessToken } from "../_shared/google-calendar.ts";
import { automatedRecipientEligible } from "../_shared/notificationEligibility.ts";

Deno.serve(async (request) => {
  const secret = Deno.env.get("CRON_SECRET");
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!((secret && request.headers.get('x-cron-secret') === secret) || (bearer && bearer === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')))) return json(request, { error: "Non autorisé" }, 401);
  const admin = adminClient();
  // Operator-only, read-only verification of a single connection. No event is created.
  const verifyProfileId = new URL(request.url).searchParams.get('verify_profile_id');
  if (verifyProfileId) {
    if (!/^[0-9a-f-]{36}$/i.test(verifyProfileId)) return json(request, { error: 'Profil invalide' }, 400);
    const { data: connection, error: connectionError } = await admin.from('calendar_connections').select('*').eq('profile_id', verifyProfileId).eq('connected', true).eq('sync_enabled', true).maybeSingle();
    if (connectionError || !connection) return json(request, { error: 'Connexion indisponible' }, 404);
    try {
      const accessToken = await getGoogleAccessToken(connection);
      const verifyEventId=new URL(request.url).searchParams.get('verify_event_id');
      if(verifyEventId&&!/^sm[0-9a-f]{32}$/.test(verifyEventId))return json(request,{error:'Événement invalide'},400);
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id || 'primary')}/events${verifyEventId?'/'+verifyEventId:'?maxResults=1'}`, { headers: { authorization: `Bearer ${accessToken}` } });
      if(verifyEventId){const event=await response.json();return json(request,{google_status:response.status,id:event.id,title:event.summary,start:event.start?.dateTime,status:event.status})}
      if (!response.ok) return json(request, { verified: false, google_status: response.status }, 502);
      return json(request, { verified: true });
    } catch {
      return json(request, { verified: false, error: 'Reconnexion Google requise' }, 502);
    }
  }
  let deleted=0,deletionFailed=0;
  const {data:deletions,error:deletionQueryError}=await admin.from('calendar_event_deletions').select('*').is('completed_at',null).order('created_at').limit(100);
  if(deletionQueryError)return json(request,{error:deletionQueryError.message},500);
  for(const job of deletions||[]){
   try{
    const {data:connection,error}=await admin.from('calendar_connections').select('*').eq('profile_id',job.profile_id).eq('connected',true).eq('sync_enabled',true).maybeSingle();
    if(error||!connection)throw new Error('Connexion Google indisponible pour la suppression en attente');
    await deleteGoogleEvent(await getGoogleAccessToken(connection),job.calendar_id,job.event_id,job.task_id);
    const {error:saveError}=await admin.from('calendar_event_deletions').update({completed_at:new Date().toISOString(),error:null}).eq('id',job.id);
    if(saveError)throw saveError;
    deleted++;
   }catch(cause){deletionFailed++;await admin.from('calendar_event_deletions').update({error:cause instanceof Error?cause.message:'Suppression impossible'}).eq('id',job.id)}
  }
  const { data: tasks, error } = await admin.rpc('pending_calendar_tasks');
  if (error) return json(request, { error: error.message }, 500);
  let synced = 0, failed = 0;
  for (const task of tasks || []) {
    try {
      if (!await automatedRecipientEligible(admin, task.assignee_id, task.tenant_owner_id)) continue;
      const { data: connection } = await admin.from("calendar_connections").select("*").eq("profile_id", task.assignee_id).eq("connected", true).eq("sync_enabled", true).maybeSingle();
      if (!connection) continue;
      const accessToken = await getGoogleAccessToken(connection);
      const calendarId=task.google_event_calendar_id||connection.calendar_id||'primary';
      const event={taskId:task.id,eventKey:task.google_event_key,title:task.title,description:task.description||'Tâche Smartsell Management',start:task.due_at,reminderMinutes:Number(task.reminder_minutes??30)};
      const eventId=task.google_event_id?await updateGoogleEvent(accessToken,calendarId,task.google_event_id,event):await createGoogleEvent(accessToken,calendarId,event);
      const {data:saved,error:saveError} = await admin.from("tasks").update({google_event_id:eventId,google_event_profile_id:task.assignee_id,google_event_calendar_id:calendarId,calendar_synced_revision:task.calendar_revision,calendar_synced_at:new Date().toISOString()}).eq('id',task.id).eq('calendar_revision',task.calendar_revision).select('id');
      if(saveError)throw new Error('Événement Google traité mais confirmation locale impossible');
      if(!saved?.length){
       // A concurrent edit/deletion must not leave an untracked newly created event.
       if(!task.google_event_id){
        const {data:linked,error:linkError}=await admin.from('tasks').update({google_event_id:eventId,google_event_profile_id:task.assignee_id,google_event_calendar_id:calendarId}).eq('id',task.id).eq('google_event_key',task.google_event_key).is('google_event_id',null).select('id');
        if(linkError)throw linkError;
        if(!linked?.length){
         const {data:current,error:readError}=await admin.from('tasks').select('google_event_id,google_event_key').eq('id',task.id).maybeSingle();
         if(readError)throw readError;
         if(current?.google_event_key!==task.google_event_key||current?.google_event_id!==eventId){const {error:queueError}=await admin.from('calendar_event_deletions').upsert({task_id:task.id,profile_id:task.assignee_id,calendar_id:calendarId,event_id:eventId},{onConflict:'profile_id,calendar_id,event_id'});if(queueError)throw queueError}
        }
       }
       continue;
      }
      synced++;
    } catch (error) {
      failed++;
      await admin.from("reminder_deliveries").insert({ task_id: task.id, profile_id: task.assignee_id, channel: "GOOGLE_CALENDAR", scheduled_for: new Date().toISOString(), status: "FAILED", error: error instanceof Error ? error.message : "Synchronisation impossible" });
    }
  }
  return json(request, { processed: tasks?.length || 0, synced, failed,deleted,deletionFailed });
});
