import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    const body = await request.json() as { action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown>; sessionId?: string };
    const allowed = ["LOGIN", "LOGOUT", "HEARTBEAT", "PAGE_VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "SEND_SMS", "SEND_EMAIL", "INITIATE_CALL", "CHANGE_PERMISSION"];
    if (!allowed.includes(body.action)) return json(request, { error: "Action inconnue" }, 400);
    if (body.sessionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.sessionId)) return json(request,{error:'Session invalide'},400);
    if (body.sessionId) {
      const {data: existing,error: lookupError}=await admin.from('user_sessions').select('profile_id').eq('id',body.sessionId).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing && existing.profile_id!==user.id) return json(request,{error:'Session non autorisée'},403);
    }
    const { error } = await admin.from("activity_logs").insert({ actor_id: user.id, action: body.action, entity_type: body.entityType, entity_id: body.entityId || null, metadata: body.metadata || {} });
    if (error) return json(request, { error: error.message }, 400);
    if (body.sessionId) {
      const now = new Date().toISOString();
      if (body.action === "LOGIN") await admin.from("user_sessions").upsert({ id: body.sessionId, profile_id: user.id, signed_in_at: now, last_seen_at: now },{onConflict:'id',ignoreDuplicates:true});
      else {
        const { data: session } = await admin.from("user_sessions").select("active_seconds,pages_viewed").eq("id", body.sessionId).eq("profile_id", user.id).maybeSingle();
        if (session) await admin.from("user_sessions").update({ last_seen_at: now, active_seconds: (session.active_seconds || 0) + (body.action === "HEARTBEAT" ? 60 : 0), pages_viewed: (session.pages_viewed || 0) + (body.action === "PAGE_VIEW" ? 1 : 0), ...(body.action === "LOGOUT" ? { signed_out_at: now } : {}) }).eq('id',body.sessionId).eq('profile_id',user.id);
      }
    }
    return json(request, { ok: true });
  } catch (error) { return edgeError(request, error); }
});
