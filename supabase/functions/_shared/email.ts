export type EmailDelivery = { id?: string; status?: string };

export async function sendResendEmail(recipients: string[], subject: string, message: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!apiKey || !from) throw new Error("Fournisseur e-mail non configuré (RESEND_API_KEY / EMAIL_FROM)");
  const deliveries: EmailDelivery[] = [];
  for (const recipient of recipients) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [recipient], subject, text: message }),
    });
    const data = await response.json().catch(() => ({})) as EmailDelivery & { message?: string };
    if (!response.ok) throw new Error(data.message || `Le fournisseur e-mail a répondu ${response.status}`);
    deliveries.push(data);
  }
  return deliveries;
}
