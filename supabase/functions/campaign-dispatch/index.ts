import { authenticated, adminClient, edgeError, handleOptions, json } from "../_shared/http.ts";
import { sendNimbaSms } from "../_shared/nimba.ts";
import { sendResendEmail } from "../_shared/email.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const body = await request.json().catch(() => ({})) as { campaign_id?: string };
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const cronAuthorized = bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || bearer === Deno.env.get("SUPABASE_ANON_KEY") || request.headers.get("x-cron-secret") === Deno.env.get("CRON_SECRET");
    if (!cronAuthorized) await authenticated(request);
    const admin = adminClient(), now = new Date().toISOString();
    let query = admin.from("campaigns").select("id,name,channel,status,scheduled_at,created_by,communication_templates(subject,body)").in("status", ["QUEUED", "DRAFT"]).lte("scheduled_at", now).order("scheduled_at").limit(10);
    if (body.campaign_id) query = query.eq("id", body.campaign_id);
    const { data: campaigns, error } = await query; if (error) throw error;
    let sent = 0, failed = 0;
    for (const campaign of campaigns || []) {
      const template = Array.isArray(campaign.communication_templates) ? campaign.communication_templates[0] : campaign.communication_templates;
      const { data: rows, error: recipientError } = await admin.from("campaign_recipients").select("id,address").eq("campaign_id", campaign.id).eq("status", "QUEUED");
      if (recipientError) throw recipientError;
      const addresses = (rows || []).map((row) => row.address).filter(Boolean);
      if (!addresses.length || !template?.body) { await admin.from("campaigns").update({ status: "FAILED" }).eq("id", campaign.id); failed++; continue; }
      try {
        if (campaign.channel === "SMS") await sendNimbaSms(addresses, template.body);
        else await sendResendEmail(addresses, template.subject || campaign.name, template.body);
        await admin.from("campaign_recipients").update({ status: "SENT" }).eq("campaign_id", campaign.id).eq("status", "QUEUED");
        await admin.from("communication_logs").insert(addresses.map((recipient) => ({ channel: campaign.channel, recipient, campaign_id: campaign.id, status: "SENT", sent_by: campaign.created_by, metadata: { provider: campaign.channel === "SMS" ? "NIMBA" : "RESEND", scheduled: true } })));
        await admin.from("campaigns").update({ status: "SENT" }).eq("id", campaign.id); sent++;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Envoi impossible";
        await admin.from("campaign_recipients").update({ status: "FAILED", error: message }).eq("campaign_id", campaign.id).eq("status", "QUEUED");
        await admin.from("campaigns").update({ status: "FAILED" }).eq("id", campaign.id); failed++;
      }
    }
    return json(request, { processed: campaigns?.length || 0, sent, failed });
  } catch (error) { return edgeError(request, error); }
});
