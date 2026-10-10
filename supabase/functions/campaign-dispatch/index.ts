import { authenticated, adminClient, edgeError, handleOptions, json, requireActions } from "../_shared/http.ts";
import { sendNimbaSms } from "../_shared/nimba.ts";
import { sendResendEmail } from "../_shared/email.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const body = await request.json().catch(() => ({})) as { campaign_id?: string };
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const secret=Deno.env.get('CRON_SECRET');
    const cronAuthorized = Boolean((bearer && bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) || (secret && request.headers.get("x-cron-secret") === secret));
    const caller = !cronAuthorized ? await authenticated(request) : null;
    const admin = adminClient(), now = new Date().toISOString();
    if(caller)await requireActions(admin,caller.user.id,['communication.send']);
    let query = admin.from("campaigns").select("id,name,channel,status,scheduled_at,created_by,tenant_owner_id,communication_templates(subject,body)").eq("status", "QUEUED").eq('approval_status','APPROUVE').lte("scheduled_at", now).order("scheduled_at").limit(10);
    if(caller){const {data:profile}=await admin.from('profiles').select('tenant_owner_id').eq('id',caller.user.id).single();query=query.eq('tenant_owner_id',profile?.tenant_owner_id||caller.user.id);}
    if (body.campaign_id) query = query.eq("id", body.campaign_id);
    const { data: campaigns, error } = await query; if (error) throw error;
    let sent = 0, failed = 0;
    for (const campaign of campaigns || []) {
      const {data:stillAllowed,error:grantError}=await admin.rpc('member_action_allowed',{p_profile_id:campaign.created_by,p_action:'communication.send'});
      if(grantError||stillAllowed!==true){failed++;continue;}
      const template = Array.isArray(campaign.communication_templates) ? campaign.communication_templates[0] : campaign.communication_templates;
      const { data: rows, error: recipientError } = await admin.from("campaign_recipients").select("id,address").eq("campaign_id", campaign.id).eq("status", "QUEUED");
      if (recipientError) throw recipientError;
      const addresses = (rows || []).map((row) => row.address).filter(Boolean);
      if (!addresses.length || !template?.body) { await admin.from("campaigns").update({ status: "FAILED" }).eq("id", campaign.id); failed++; continue; }
      const {data:claim,error:claimError}=await admin.from('campaigns').update({status:'PROCESSING'}).eq('id',campaign.id).eq('status','QUEUED').select('id').maybeSingle();
      if(claimError)throw claimError;if(!claim)continue;
      let logIds:(string|number)[]=[];
      try {
        const {data:reserved,error:quotaError}=await admin.rpc('reserve_communication_dispatch',{p_actor:campaign.created_by,p_channel:campaign.channel,p_recipients:addresses,p_campaign:campaign.id});
        if(quotaError)throw quotaError;logIds=reserved||[];
        if (campaign.channel === "SMS") {if(!campaign.tenant_owner_id)throw new Error('Entreprise SMS manquante');await sendNimbaSms(addresses, template.body, campaign.tenant_owner_id);}
        else await sendResendEmail(addresses, template.subject || campaign.name, template.body);
        await admin.from("campaign_recipients").update({ status: "SENT" }).eq("campaign_id", campaign.id).eq("status", "QUEUED");
        await admin.from('communication_logs').update({status:'SENT',metadata:{provider:campaign.channel==='SMS'?'NIMBA':'RESEND',scheduled:true}}).in('id',logIds);
        await admin.from("campaigns").update({ status: "SENT" }).eq("id", campaign.id); sent++;
      } catch (caught) {
        if(logIds.length)await admin.from('communication_logs').update({status:'FAILED'}).in('id',logIds);
        const message = caught instanceof Error ? caught.message : "Envoi impossible";
        await admin.from("campaign_recipients").update({ status: "FAILED", error: message }).eq("campaign_id", campaign.id).eq("status", "QUEUED");
        await admin.from("campaigns").update({ status: "FAILED" }).eq("id", campaign.id); failed++;
      }
    }
    return json(request, { processed: campaigns?.length || 0, sent, failed });
  } catch (error) { return edgeError(request, error); }
});
