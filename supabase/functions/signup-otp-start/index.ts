import { adminClient, edgeError, handleOptions, json } from "../_shared/http.ts";
import { sendNimbaSms } from "../_shared/nimba.ts";

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("224") ? digits : digits.length === 9 ? `224${digits}` : digits;
};

const hashCode = async (code: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const body = await request.json() as { phone?: string; email?: string; full_name?: string; company_name?: string };
    const phone = normalizePhone(body.phone || "");
    const email = body.email?.trim().toLowerCase() || "";
    const fullName = body.full_name?.trim() || "";
    const companyName = body.company_name?.trim() || "";
    if (!/^224\d{9}$/.test(phone) || !email || !fullName || !companyName) return json(request, { error: "Téléphone guinéen, e-mail, nom et entreprise requis." }, 400);
    const admin = adminClient();
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await admin.from("signup_otp_challenges").select("id", { count: "exact", head: true }).or(`phone.eq.${phone},email.eq.${email}`).gte("created_at", since);
    if ((count || 0) >= 3) return json(request, { error: "Trop de demandes. Réessayez dans 15 minutes." }, 429);
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const code = String(100000 + (random[0] % 900000));
    const codeHash = await hashCode(code);
    const { data: challenge, error } = await admin.from("signup_otp_challenges").insert({ phone, email, full_name: fullName, company_name: companyName, code_hash: codeHash, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }).select("id,expires_at").single();
    if (error || !challenge) throw new Error(error?.message || "Défi OTP impossible");
    await sendNimbaSms([phone], `SmartSell : votre code de confirmation est ${code}. Il expire dans 10 minutes. Ne le partagez avec personne.`);
    return json(request, { challenge_id: challenge.id, expires_at: challenge.expires_at });
  } catch (error) { return edgeError(request, error); }
});
