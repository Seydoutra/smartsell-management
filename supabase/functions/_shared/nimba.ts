import { adminClient } from './http.ts';
export type NimbaMessage = { uid?: string; id?: string; status?: string; message_cost?: number; currency?: string };

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("224")) return digits;
  return digits.length === 9 ? `224${digits}` : digits;
};

export async function sendNimbaSms(recipients: string[], message: string, tenantOwnerId?: string) {
  let serviceId = Deno.env.get("NIMBA_SERVICE_ID");
  let secretToken = Deno.env.get("NIMBA_SECRET_TOKEN");
  let senderName = Deno.env.get("NIMBA_SENDER_NAME") || "SMARTSELL";
  if (tenantOwnerId) {
    const admin=adminClient();
    const {data:config,error}=await admin.rpc('get_tenant_sms_credentials',{p_tenant:tenantOwnerId});
    if(error)throw new Error('Configuration SMS de cette entreprise indisponible');
    if(config?.[0])({service_id:serviceId,secret_token:secretToken,sender_name:senderName}=config[0]);
    else {
      const {data:owner}=await admin.from('profiles').select('is_platform_owner').eq('id',tenantOwnerId).single();
      const {data:settings,error:settingsError}=await admin.from('tenant_sms_settings').select('status').eq('tenant_owner_id',tenantOwnerId).maybeSingle();
      if(settingsError||settings||!owner?.is_platform_owner)throw new Error('SMS non activés pour cette entreprise. Consultez Paramètres SMS.');
    }
  }
  if (!serviceId || !secretToken) throw new Error("Identifiants Nimba SMS manquants");
  const response = await fetch("https://api.nimbasms.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${btoa(`${serviceId}:${secretToken}`)}` },
    body: JSON.stringify({ to: recipients.map(normalizePhone), message, sender_name: senderName }),
  });
  const data = await response.json().catch(() => ({})) as NimbaMessage & { detail?: string; message?: string };
  if (!response.ok) throw new Error(data.detail || data.message || `Nimba SMS a répondu ${response.status}`);
  return data;
}
