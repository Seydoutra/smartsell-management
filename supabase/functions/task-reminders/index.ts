import { adminClient, json } from "../_shared/http.ts";
import { sendNimbaSms } from "../_shared/nimba.ts";

Deno.serve(async (request) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || request.headers.get("x-cron-secret") !== secret) return json(request, { error: "Non autorisé" }, 401);
  const admin = adminClient(), now = new Date(), horizon = new Date(now.getTime() + 24 * 60 * 60_000);
  const { data: tasks, error } = await admin.from("tasks").select("id,title,due_at,reminder_minutes,notification_channels,assignee_id,profiles:assignee_id(full_name,phone,notification_preferences)").neq("status", "TERMINE").is("reminder_sent_at", null).gte("due_at", now.toISOString()).lte("due_at", horizon.toISOString());
  if (error) return json(request, { error: error.message }, 500);
  let delivered = 0;
  for (const task of tasks || []) {
    const due = new Date(task.due_at), sendAt = new Date(due.getTime() - Number(task.reminder_minutes || 30) * 60_000);
    if (sendAt > now) continue;
    const channels = (task.notification_channels?.length ? task.notification_channels : ["IN_APP"]) as string[];
    for (const channel of channels) {
      let status = channel === "IN_APP" ? "DELIVERED" : "QUEUED", providerMessageId: string | null = null, errorMessage: string | null = null;
      if (channel === "IN_APP" && task.assignee_id) await admin.from("notifications").insert({ profile_id: task.assignee_id, channel: "IN_APP", title: `Rappel : ${task.title}`, body: `Échéance ${due.toLocaleString("fr-FR")}`, entity_type: "task", entity_id: task.id });
      if (channel === "SMS") try {
        const profile = Array.isArray(task.profiles) ? task.profiles[0] : task.profiles;
        const phone = Deno.env.get("COMMUNICATION_TEST_MODE") !== "false" ? Deno.env.get("COMMUNICATION_TEST_PHONE") : profile?.phone;
        if (!phone) throw new Error("Numéro de téléphone manquant");
        const sent = await sendNimbaSms([phone], `Rappel SmartSell : ${task.title}. Échéance ${due.toLocaleString("fr-FR", { timeZone: "Africa/Conakry" })}.`);
        status = "SENT"; providerMessageId = sent.uid || sent.id || null;
      } catch (error) { status = "FAILED"; errorMessage = error instanceof Error ? error.message : "Envoi SMS impossible"; }
      if (["EMAIL", "WHATSAPP"].includes(channel)) { status = "FAILED"; errorMessage = `${channel} n’est pas encore configuré`; }
      await admin.from("reminder_deliveries").upsert({ task_id: task.id, profile_id: task.assignee_id, channel, scheduled_for: sendAt.toISOString(), status, provider_message_id: providerMessageId, error: errorMessage }, { onConflict: "task_id,channel,scheduled_for" });
      delivered++;
    }
    await admin.from("tasks").update({ reminder_sent_at: now.toISOString() }).eq("id", task.id);
  }
  return json(request, { processed: tasks?.length || 0, delivered });
});
