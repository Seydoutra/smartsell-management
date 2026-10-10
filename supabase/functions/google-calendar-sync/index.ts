import { adminClient, json } from "../_shared/http.ts";
import { createGoogleEvent, getGoogleAccessToken } from "../_shared/google-calendar.ts";
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
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id || 'primary')}/events?maxResults=1`, { headers: { authorization: `Bearer ${accessToken}` } });
      if (!response.ok) return json(request, { verified: false, google_status: response.status }, 502);
      return json(request, { verified: true });
    } catch {
      return json(request, { verified: false, error: 'Reconnexion Google requise' }, 502);
    }
  }
  const { data: tasks, error } = await admin.from("tasks").select("id,title,description,due_at,reminder_minutes,assignee_id,tenant_owner_id").not("assignee_id", "is", null).not("due_at", "is", null).is("google_event_id", null).not('status','in','(TERMINE,ANNULEE)').gte("due_at", new Date().toISOString()).limit(100);
  if (error) return json(request, { error: error.message }, 500);
  let synced = 0, failed = 0;
  for (const task of tasks || []) {
    try {
      if (!await automatedRecipientEligible(admin, task.assignee_id, task.tenant_owner_id)) continue;
      const { data: connection } = await admin.from("calendar_connections").select("*").eq("profile_id", task.assignee_id).eq("connected", true).eq("sync_enabled", true).maybeSingle();
      if (!connection) continue;
      const accessToken = await getGoogleAccessToken(connection);
      const eventId = await createGoogleEvent(accessToken, connection.calendar_id || "primary", { taskId: task.id, title: task.title, description: task.description || 'Tâche Smartsell Management', start: task.due_at, reminderMinutes: Number(task.reminder_minutes || 30) });
      const {error:saveError} = await admin.from("tasks").update({ google_event_id: eventId, calendar_synced_at: new Date().toISOString() }).eq("id", task.id);
      if (saveError) throw new Error('Événement Google créé mais synchronisation locale non enregistrée : vérification nécessaire avant nouvel essai.');
      synced++;
    } catch (error) {
      failed++;
      await admin.from("reminder_deliveries").insert({ task_id: task.id, profile_id: task.assignee_id, channel: "GOOGLE_CALENDAR", scheduled_for: new Date().toISOString(), status: "FAILED", error: error instanceof Error ? error.message : "Synchronisation impossible" });
    }
  }
  return json(request, { processed: tasks?.length || 0, synced, failed });
});
