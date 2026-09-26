type WelcomeInput = {
  name: string;
  email: string;
  phone?: string | null;
  temporaryPassword: string;
  loginUrl: string;
};

export type DeliveryResult = {
  channel: "EMAIL" | "WHATSAPP";
  status: "SENT" | "SKIPPED" | "FAILED";
  detail?: string;
};

const cleanPhone = (value?: string | null) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("224")) return digits;
  if (digits.length === 9) return `224${digits}`;
  return digits;
};

const welcomeText = ({ name, email, temporaryPassword, loginUrl }: WelcomeInput) =>
  `Bonjour ${name},\n\nBienvenue sur SmartSell Management.\n\nVotre identifiant de connexion : ${email}\nVotre mot de passe temporaire : ${temporaryPassword}\nLien de connexion : ${loginUrl}\n\nPour votre sécurité, vous devrez choisir un nouveau mot de passe dès votre première connexion.\n\nL'équipe SmartSell`;

export async function sendWelcomeEmail(input: WelcomeInput): Promise<DeliveryResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!apiKey || !from) return { channel: "EMAIL", status: "SKIPPED", detail: "Fournisseur e-mail non configuré" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [input.email], subject: "Bienvenue sur SmartSell Management", text: welcomeText(input), html: welcomeHtml(input) }),
  });
  if (!response.ok) return { channel: "EMAIL", status: "FAILED", detail: `Erreur fournisseur (${response.status})` };
  return { channel: "EMAIL", status: "SENT" };
}

export async function sendWelcomeWhatsApp(input: WelcomeInput): Promise<DeliveryResult> {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const template = Deno.env.get("WHATSAPP_WELCOME_TEMPLATE") || "smartsell_welcome";
  const language = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "fr";
  const phone = cleanPhone(input.phone);
  if (!phone) return { channel: "WHATSAPP", status: "SKIPPED", detail: "Numéro WhatsApp absent" };
  if (!token || !phoneNumberId) return { channel: "WHATSAPP", status: "SKIPPED", detail: "WhatsApp Cloud API non configurée" };
  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: phone, type: "template",
      template: { name: template, language: { code: language }, components: [{ type: "body", parameters: [input.name, input.email, input.temporaryPassword, input.loginUrl].map((text) => ({ type: "text", text })) }] },
    }),
  });
  if (!response.ok) return { channel: "WHATSAPP", status: "FAILED", detail: `Erreur fournisseur (${response.status})` };
  return { channel: "WHATSAPP", status: "SENT" };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function welcomeHtml(input: WelcomeInput) {
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#201526"><h1 style="color:#6a2b85">Bienvenue sur SmartSell</h1><p>Bonjour <strong>${escapeHtml(input.name)}</strong>,</p><p>Votre profil SmartSell Management vient d’être créé.</p><div style="background:#f7f3fa;padding:18px;border-radius:12px"><p><strong>Identifiant :</strong> ${escapeHtml(input.email)}</p><p><strong>Mot de passe temporaire :</strong> ${escapeHtml(input.temporaryPassword)}</p></div><p><a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#6a2b85;color:white;padding:12px 18px;border-radius:9px;text-decoration:none">Ouvrir SmartSell</a></p><p>Vous devrez choisir un nouveau mot de passe lors de votre première connexion.</p><p>L’équipe SmartSell</p></div>`;
}
