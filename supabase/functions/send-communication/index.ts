import {authenticated,edgeError,handleOptions,json} from "../_shared/http.ts";
import {sendNimbaSms} from "../_shared/nimba.ts";
import {sendResendEmail} from "../_shared/email.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    const {data:allowed,error:permissionError}=await admin.rpc('member_action_allowed',{p_profile_id:user.id,p_action:'communication.send'});
    if(permissionError||!allowed)return json(request,{error:'Envoi non autorisé pour votre compte.'},403);
    const body = await request.json() as { channel: "SMS" | "EMAIL"; recipients: string[]; message: string; subject?: string };
    if (!["SMS", "EMAIL"].includes(body.channel) || !body.message?.trim() || !Array.isArray(body.recipients)) return json(request, { error: "Message invalide" }, 400);
    const testMode = Deno.env.get("COMMUNICATION_TEST_MODE") === "true";
    const campaignLimit = Number(Deno.env.get(body.channel === "SMS" ? "MAX_SMS_PER_CAMPAIGN" : "MAX_EMAILS_PER_CAMPAIGN") || 250);
    if (body.recipients.length > campaignLimit) return json(request, { error: `La limite de ${campaignLimit} destinataires est dépassée.` }, 400);
    const {data:profile,error:profileError}=await admin.from("profiles").select("tenant_owner_id").eq("id",user.id).single();
    if(profileError)throw profileError;
    const recipients = testMode ? [body.channel === "SMS" ? Deno.env.get("COMMUNICATION_TEST_PHONE") : Deno.env.get("COMMUNICATION_TEST_EMAIL")].filter(Boolean) as string[] : body.recipients;
    if (!recipients.length) return json(request, { error: "Aucun destinataire de test configuré" }, 400);
    const {data:logIds,error:quotaError}=await admin.rpc("reserve_communication_dispatch",{p_actor:user.id,p_channel:body.channel,p_recipients:recipients});
    if(quotaError)return json(request,{error:quotaError.message},403);
    let provider: { uid?: string; id?: string; status?: string; message_cost?: number; currency?: string } | null = null;
    try {
    if (body.channel === "SMS") provider = await sendNimbaSms(recipients, body.message.trim(), profile?.tenant_owner_id||user.id, true);
    else {
      const deliveries = await sendResendEmail(recipients, body.subject?.trim() || "Message de SmartSell", body.message.trim());
      provider = { id: deliveries[0]?.id, status: "SENT" };
    }
    await admin.from("communication_logs").update({status:"SENT",provider_message_id:provider?.uid||provider?.id||null,sms_cost:provider?.message_cost||null,sms_currency:provider?.currency||null,metadata:{test_mode:testMode,provider:body.channel==="SMS"?"NIMBA":"RESEND"}}).in("id",logIds);
    } catch(error){await admin.from("communication_logs").update({status:"FAILED"}).in("id",logIds);throw error;}
    return json(request, { status: "SENT", testMode, recipientCount: recipients.length, providerStatus: provider?.status || null });
  } catch (error) { return edgeError(request, error); }
});
