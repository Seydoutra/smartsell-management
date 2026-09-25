import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";
import { sendNimbaSms } from "../_shared/nimba.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    const body = await request.json() as { channel: "SMS" | "EMAIL"; recipients: string[]; message: string };
    if (!["SMS", "EMAIL"].includes(body.channel) || !body.message?.trim() || !Array.isArray(body.recipients)) return json(request, { error: "Message invalide" }, 400);
    const testMode = Deno.env.get("COMMUNICATION_TEST_MODE") !== "false";
    const campaignLimit = Number(Deno.env.get(body.channel === "SMS" ? "MAX_SMS_PER_CAMPAIGN" : "MAX_EMAILS_PER_CAMPAIGN") || 250);
    if (body.recipients.length > campaignLimit) return json(request, { error: `La limite de ${campaignLimit} destinataires est dépassée.` }, 400);
    const { data: access } = await admin.from("user_access_controls").select("max_sms_per_day,max_emails_per_day").eq("profile_id", user.id).maybeSingle();
    const dailyLimit = body.channel === "SMS" ? Number(access?.max_sms_per_day ?? 0) : Number(access?.max_emails_per_day ?? 10);
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { count } = await admin.from("communication_logs").select("id", { count: "exact", head: true }).eq("sent_by", user.id).eq("channel", body.channel).gte("sent_at", since.toISOString()).in("status", ["QUEUED", "SENT", "DELIVERED"]);
    if (dailyLimit >= 0 && (count || 0) + body.recipients.length > dailyLimit) return json(request, { error: `Votre limite quotidienne de ${dailyLimit} ${body.channel.toLowerCase()} est dépassée.` }, 403);
    const recipients = testMode ? [body.channel === "SMS" ? Deno.env.get("COMMUNICATION_TEST_PHONE") : Deno.env.get("COMMUNICATION_TEST_EMAIL")].filter(Boolean) as string[] : body.recipients;
    if (!recipients.length) return json(request, { error: "Aucun destinataire de test configuré" }, 400);
    let provider: { uid?: string; id?: string; message_cost?: number; currency?: string } | null = null;
    if (body.channel === "SMS") provider = await sendNimbaSms(recipients, body.message.trim());
    else throw new Error("Le fournisseur e-mail n’est pas encore configuré");
    await admin.from("communication_logs").insert(recipients.map((recipient) => ({ channel: body.channel, recipient, status: testMode ? "QUEUED" : "SENT", provider_message_id: provider?.uid || provider?.id || null, sms_cost: provider?.message_cost || null, sms_currency: provider?.currency || null, sent_by: user.id, metadata: { test_mode: testMode, provider: "NIMBA" } })));
    return json(request, { status: testMode ? "QUEUED" : "SENT", testMode, recipientCount: recipients.length });
  } catch (error) { return edgeError(request, error); }
});
