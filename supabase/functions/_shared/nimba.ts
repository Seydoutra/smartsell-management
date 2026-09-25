export type NimbaMessage = { uid?: string; id?: string; status?: string; message_cost?: number; currency?: string };

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("224")) return digits;
  return digits.length === 9 ? `224${digits}` : digits;
};

export async function sendNimbaSms(recipients: string[], message: string) {
  const serviceId = Deno.env.get("NIMBA_SERVICE_ID");
  const secretToken = Deno.env.get("NIMBA_SECRET_TOKEN");
  const senderName = Deno.env.get("NIMBA_SENDER_NAME") || "SMARTSELL";
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
