import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    const body = await request.json() as { password?: string };
    if (!body.password || body.password.length < 10 || !/[A-Z]/.test(body.password) || !/[a-z]/.test(body.password) || !/\d/.test(body.password)) {
      return json(request, { error: "Utilisez au moins 10 caractères avec majuscule, minuscule et chiffre." }, 400);
    }
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, { password: body.password });
    if (authError) return json(request, { error: authError.message }, 400);
    const { error: profileError } = await admin.from("profiles").update({ must_change_password: false }).eq("id", user.id);
    if (profileError) return json(request, { error: profileError.message }, 400);
    await admin.from("activity_logs").insert({ actor_id: user.id, action: "UPDATE", entity_type: "profile", entity_id: user.id, metadata: { password_changed: true } });
    return json(request, { success: true });
  } catch (error) { return edgeError(request, error); }
});
