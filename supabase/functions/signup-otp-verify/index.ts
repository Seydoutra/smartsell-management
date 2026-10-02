import { adminClient, edgeError, handleOptions, json } from "../_shared/http.ts";

const hashCode = async (code: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const body = await request.json() as { challenge_id?: string; code?: string; password?: string; referral_code?: string };
    if (!body.challenge_id || !/^\d{6}$/.test(body.code || "") || !body.password || body.password.length < 10) return json(request, { error: "Défi, code ou mot de passe invalide." }, 400);
    const admin = adminClient();
    const { data: challenge, error } = await admin.from("signup_otp_challenges").select("*").eq("id", body.challenge_id).maybeSingle();
    if (error || !challenge) return json(request, { error: "Code introuvable. Demandez un nouveau code." }, 404);
    if (challenge.verified_at) return json(request, { error: "Ce code a déjà été utilisé." }, 400);
    if (new Date(challenge.expires_at).getTime() <= Date.now()) return json(request, { error: "Code expiré. Demandez un nouveau code." }, 400);
    if (challenge.attempts >= challenge.max_attempts) return json(request, { error: "Nombre maximal d’essais atteint." }, 429);
    const valid = (await hashCode(body.code!)) === challenge.code_hash;
    if (!valid) {
      await admin.from("signup_otp_challenges").update({ attempts: challenge.attempts + 1 }).eq("id", challenge.id);
      return json(request, { error: "Code incorrect." }, 400);
    }
    await admin.from("signup_otp_challenges").update({ verified_at: new Date().toISOString() }).eq("id", challenge.id);
    const referralCode = /^[A-F0-9]{10}$/.test(String(body.referral_code || '').toUpperCase()) ? String(body.referral_code).toUpperCase() : null;
    const { data, error: createError } = await admin.auth.admin.createUser({ email: challenge.email, password: body.password, email_confirm: true, user_metadata: { name: challenge.full_name, full_name: challenge.full_name, company_name: challenge.company_name, phone: challenge.phone, signup_channel: "SMS_OTP", referral_code: referralCode } });
    if (createError || !data.user) return json(request, { error: createError?.message || "Création du compte impossible." }, 400);
    await admin.from("profiles").update({ phone: challenge.phone, email: challenge.email }).eq("id", data.user.id);
    return json(request, { success: true, email: challenge.email });
  } catch (error) { return edgeError(request, error); }
});
