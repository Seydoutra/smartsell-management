import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";
import { sendNimbaSms } from "../_shared/nimba.ts";
import { sendResendEmail } from "../_shared/email.ts";

const defaultDailyLimits: Record<string, { SMS: number; EMAIL: number }> = {
  SUPER_ADMIN: { SMS: Number.POSITIVE_INFINITY, EMAIL: Number.POSITIVE_INFINITY },
  ADMIN: { SMS: 500, EMAIL: 1000 },
  MANAGER: { SMS: 200, EMAIL: 500 },
  CHEF_DE_PROJET: { SMS: 30, EMAIL: 100 },
  COMMERCIAL: { SMS: 100, EMAIL: 250 },
  COMMUNITY_MANAGER: { SMS: 50, EMAIL: 100 },
  COMPTABLE: { SMS: 20, EMAIL: 100 },
  COLLABORATEUR: { SMS: 0, EMAIL: 10 },
};

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    const body = await request.json() as { channel: "SMS" | "EMAIL"; recipients: string[]; message: string; subject?: string };
    if (!["SMS", "EMAIL"].includes(body.channel) || !body.message?.trim() || !Array.isArray(body.recipients)) return json(request, { error: "Message invalide" }, 400);
    const testMode = Deno.env.get("COMMUNICATION_TEST_MODE") === "true";
    const campaignLimit = Number(Deno.env.get(body.channel === "SMS" ? "MAX_SMS_PER_CAMPAIGN" : "MAX_EMAILS_PER_CAMPAIGN") || 250);
    if (body.recipients.length > campaignLimit) return json(request, { error: `La limite de ${campaignLimit} destinataires est dépassée.` }, 400);
    const [{ data: access }, { data: profile }] = await Promise.all([
      admin.from("user_access_controls").select("max_sms_per_day,max_emails_per_day").eq("profile_id", user.id).maybeSingle(),
      admin.from("profiles").select("role,tenant_owner_id").eq("id", user.id).single(),
    ]);
    const role = String(profile?.role || "COLLABORATEUR");
    const fallback = defaultDailyLimits[role] || defaultDailyLimits.COLLABORATEUR;
    const configuredLimit = body.channel === "SMS" ? access?.max_sms_per_day : access?.max_emails_per_day;
    // A legacy SUPER_ADMIN access row could contain 0 because of the old database default.
    // Super administrators remain unrestricted; other users keep their explicit per-user limit.
    const dailyLimit = role === "SUPER_ADMIN" ? Number.POSITIVE_INFINITY : Number(configuredLimit ?? fallback[body.channel]);
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { count } = await admin.from("communication_logs").select("id", { count: "exact", head: true }).eq("sent_by", user.id).eq("channel", body.channel).gte("sent_at", since.toISOString()).in("status", ["QUEUED", "SENT", "DELIVERED"]);
    if (Number.isFinite(dailyLimit) && dailyLimit >= 0 && (count || 0) + body.recipients.length > dailyLimit) return json(request, { error: `Votre limite quotidienne de ${dailyLimit} ${body.channel.toLowerCase()} est dépassée.` }, 403);
    const recipients = testMode ? [body.channel === "SMS" ? Deno.env.get("COMMUNICATION_TEST_PHONE") : Deno.env.get("COMMUNICATION_TEST_EMAIL")].filter(Boolean) as string[] : body.recipients;
    if (!recipients.length) return json(request, { error: "Aucun destinataire de test configuré" }, 400);
    let provider: { uid?: string; id?: string; status?: string; message_cost?: number; currency?: string } | null = null;
    if (body.channel === "SMS") provider = await sendNimbaSms(recipients, body.message.trim(), profile?.tenant_owner_id||user.id);
    else {
      const deliveries = await sendResendEmail(recipients, body.subject?.trim() || "Message de SmartSell", body.message.trim());
      provider = { id: deliveries[0]?.id, status: "SENT" };
    }
    await admin.from("communication_logs").insert(recipients.map((recipient) => ({ channel: body.channel, recipient, status: testMode ? "QUEUED" : "SENT", provider_message_id: provider?.uid || provider?.id || null, sms_cost: provider?.message_cost || null, sms_currency: provider?.currency || null, sent_by: user.id, metadata: { test_mode: testMode, provider: body.channel === "SMS" ? "NIMBA" : "RESEND" } })));
    return json(request, { status: testMode ? "QUEUED" : "SENT", testMode, recipientCount: recipients.length, providerStatus: provider?.status || null });
  } catch (error) { return edgeError(request, error); }
});
