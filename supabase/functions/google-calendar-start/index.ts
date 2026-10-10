import { authenticated, edgeError, handleOptions, json, requireActions } from "../_shared/http.ts";

const hex = (bytes: Uint8Array) => [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
const base64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    await requireActions(admin,user.id,['planning.sync']);
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID"), redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
    if (!clientId || !redirectUri) return json(request, { error: "La connexion Google Agenda doit être activée une seule fois par le super administrateur. Les identifiants OAuth Google manquent encore dans Supabase." }, 503);
    const state = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const stateHash = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state))));
    const { error } = await admin.from("calendar_oauth_states").insert({ state_hash: stateHash, profile_id: user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
    if (error) return json(request, { error: error.message }, 400);
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope: "openid email https://www.googleapis.com/auth/calendar.events", state });
    return json(request, { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  } catch (error) { return edgeError(request, error); }
});
