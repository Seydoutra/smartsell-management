import { adminClient, json } from "../_shared/http.ts";
import { sendNimbaSms } from "../_shared/nimba.ts";

const messages = [
  (name: string, title: string, due: string) => `Bonjour ${name}. Petit rappel SmartSell : « ${title} » est prévue pour ${due}. Vous avez encore le temps de bien vous organiser.`,
  (name: string, title: string, due: string) => `${name}, avez-vous commencé « ${title} » ? L’échéance est ${due}. Pensez à confirmer dès que la tâche est terminée.`,
  (name: string, title: string, due: string) => `Dernier rappel SmartSell, ${name} : « ${title} » arrive à échéance ${due}. Confirmez son exécution ou finalisez-la dès maintenant.`,
];

Deno.serve(async (request) => {
  const secret = Deno.env.get("CRON_SECRET");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const authorized = (secret && request.headers.get("x-cron-secret") === secret)
    || bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || bearer === Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorized) return json(request, { error: "Non autorisé" }, 401);
  const admin = adminClient(), now = new Date();
  const { data: reminders, error } = await admin.from("task_reminder_schedule")
    .select("id,task_id,profile_id,step,scheduled_for,confirmation_token,tasks(title,due_at,status),profiles(full_name,phone)")
    .eq("status", "PENDING").lte("scheduled_for", now.toISOString()).order("scheduled_for").limit(100);
  if (error) return json(request, { error: error.message }, 500);
  let sent = 0, failed = 0, cancelled = 0;
  for (const reminder of reminders || []) {
    const task = Array.isArray(reminder.tasks) ? reminder.tasks[0] : reminder.tasks;
    const profile = Array.isArray(reminder.profiles) ? reminder.profiles[0] : reminder.profiles;
    if (!task || task.status === "TERMINE" || !task.due_at || new Date(task.due_at) <= now) {
      await admin.from("task_reminder_schedule").update({ status: "CANCELLED" }).eq("id", reminder.id); cancelled++; continue;
    }
    // Le mode test doit être explicitement activé. Une variable absente ne doit
    // jamais détourner les rappels vers un seul numéro de test en production.
    const testMode = Deno.env.get("COMMUNICATION_TEST_MODE") === "true";
    const phone = testMode ? Deno.env.get("COMMUNICATION_TEST_PHONE") : profile?.phone;
    const name = String(profile?.full_name || "collaborateur").split(/\s+/)[0];
    const due = new Date(task.due_at).toLocaleString("fr-FR", { timeZone: "Africa/Conakry", dateStyle: "short", timeStyle: "short" });
    const confirmUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/task-reminder-action?token=${reminder.confirmation_token}`;
    const body = `${messages[Math.max(0, Math.min(2, Number(reminder.step) - 1))](name, task.title, due)} Confirmer : ${confirmUrl}`;
    let status = "SENT", providerMessageId: string | null = null, errorMessage: string | null = null;
    try {
      if (!phone) throw new Error("Numéro du collaborateur manquant");
      const result = await sendNimbaSms([phone], body); providerMessageId = result.uid || result.id || null; sent++;
      await admin.from("notifications").insert({ profile_id: reminder.profile_id, channel: "IN_APP", title: `Rappel ${reminder.step}/3 : ${task.title}`, body: `Échéance ${due}.`, entity_type: "task", entity_id: reminder.task_id });
    } catch (caught) { status = "FAILED"; errorMessage = caught instanceof Error ? caught.message : "Envoi SMS impossible"; failed++; }
    await admin.from("task_reminder_schedule").update({ status, sent_at: now.toISOString(), provider_message_id: providerMessageId, error: errorMessage }).eq("id", reminder.id);
    await admin.from("reminder_deliveries").upsert({ task_id: reminder.task_id, profile_id: reminder.profile_id, channel: "SMS", scheduled_for: reminder.scheduled_for, status, provider_message_id: providerMessageId, error: errorMessage }, { onConflict: "task_id,channel,scheduled_for" });
  }
  return json(request, { processed: reminders?.length || 0, sent, failed, cancelled });
});
