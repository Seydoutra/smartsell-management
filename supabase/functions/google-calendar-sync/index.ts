import { adminClient, json } from "../_shared/http.ts";
import { createGoogleEvent, getGoogleAccessToken } from "../_shared/google-calendar.ts";

Deno.serve(async (request) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || request.headers.get("x-cron-secret") !== secret) return json(request, { error: "Non autorisé" }, 401);
  const admin = adminClient();
  const { data: tasks, error } = await admin.from("tasks").select("id,title,description,due_at,reminder_minutes,assignee_id").not("assignee_id", "is", null).not("due_at", "is", null).is("google_event_id", null).neq("status", "TERMINE").gte("due_at", new Date().toISOString()).limit(100);
  if (error) return json(request, { error: error.message }, 500);
  let synced = 0, failed = 0;
  for (const task of tasks || []) {
    try {
      const { data: connection } = await admin.from("calendar_connections").select("*").eq("profile_id", task.assignee_id).eq("connected", true).eq("sync_enabled", true).maybeSingle();
      if (!connection) continue;
      const accessToken = await getGoogleAccessToken(connection);
      const eventId = await createGoogleEvent(accessToken, connection.calendar_id || "primary", { title: task.title, description: `${task.description || "Tâche SmartSell"}\n\nCette tâche dispose aussi de trois rappels SMS intelligents SmartSell.`, start: task.due_at, reminderMinutes: Number(task.reminder_minutes || 30) });
      await admin.from("tasks").update({ google_event_id: eventId, calendar_synced_at: new Date().toISOString() }).eq("id", task.id);
      synced++;
    } catch (error) {
      failed++;
      await admin.from("reminder_deliveries").insert({ task_id: task.id, profile_id: task.assignee_id, channel: "GOOGLE_CALENDAR", scheduled_for: new Date().toISOString(), status: "FAILED", error: error instanceof Error ? error.message : "Synchronisation impossible" });
    }
  }
  return json(request, { processed: tasks?.length || 0, synced, failed });
});
