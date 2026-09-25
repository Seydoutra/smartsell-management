import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";

const roles = new Set(["ADMIN", "MANAGER", "CHEF_DE_PROJET", "COMMERCIAL", "COMMUNITY_MANAGER", "GRAPHISTE", "VIDEASTE", "PHOTOGRAPHE", "DEVELOPPEUR", "COMPTABLE", "COLLABORATEUR"]);

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    const { data: caller } = await admin.from("profiles").select("role,active").eq("id", user.id).single();
    if (!caller?.active || !["SUPER_ADMIN", "ADMIN"].includes(caller.role)) return json(request, { error: "Permission refusée" }, 403);
    const body = await request.json() as { email?: string; password?: string; name?: string; role?: string; department_id?: string };
    const email = body.email?.trim().toLowerCase(), name = body.name?.trim(), role = body.role?.trim();
    if (!email || !name || !role || !roles.has(role)) return json(request, { error: "Nom, e-mail et rôle valides requis" }, 400);
    if (!body.password || body.password.length < 8) return json(request, { error: "Le mot de passe temporaire doit contenir au moins 8 caractères" }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { name } });
    if (error || !data.user) return json(request, { error: error?.message || "Création impossible" }, 400);
    const { error: profileError } = await admin.from("profiles").upsert({ id: data.user.id, full_name: name, role, department_id: body.department_id || null, active: true, must_change_password: true });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json(request, { error: `Profil non créé : ${profileError.message}` }, 400);
    }
    await admin.from("activity_logs").insert({ actor_id: user.id, action: "CREATE", entity_type: "profile", entity_id: data.user.id, metadata: { email, role } });
    return json(request, { id: data.user.id }, 201);
  } catch (error) { return edgeError(request, error); }
});
