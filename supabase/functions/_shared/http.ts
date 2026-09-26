import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://seydoutra.github.io",
]);

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "access-control-allow-origin": allowedOrigins.has(origin) ? origin : "https://seydoutra.github.io",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    vary: "Origin",
  };
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "content-type": "application/json; charset=utf-8" },
  });
}

export function handleOptions(request: Request) {
  return request.method === "OPTIONS"
    ? new Response(null, { status: 204, headers: corsHeaders(request) })
    : null;
}

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Configuration Supabase serveur manquante");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticated(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: { ...corsHeaders(request), "content-type": "application/json" } });
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: { ...corsHeaders(request), "content-type": "application/json" } });
  const { data: profile } = await admin.from("profiles").select("is_beta_tester").eq("id", data.user.id).maybeSingle();
  if (profile?.is_beta_tester) throw new Response(JSON.stringify({ error: "Action réelle désactivée dans le bac à sable bêta" }), { status: 403, headers: { ...corsHeaders(request), "content-type": "application/json" } });
  return { admin, user: data.user };
}

export function edgeError(request: Request, error: unknown) {
  if (error instanceof Response) return error;
  console.error(error);
  return json(request, { error: error instanceof Error ? error.message : "Erreur serveur" }, 500);
}
