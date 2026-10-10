import { adminClient, edgeError, handleOptions, json } from "../_shared/http.ts";

const allRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CHEF_DE_PROJET", "COMMERCIAL", "COMMUNITY_MANAGER", "COMPTABLE", "DEVELOPPEUR", "GRAPHISTE", "VIDEASTE", "PHOTOGRAPHE", "COLLABORATEUR"];
const allModules = ["Dashboard", "Prospects", "Clients", "Projets", "Tâches", "Planning", "Éditorial", "Services", "Factures", "Documents commerciaux", "Comptabilité", "Fournisseurs", "Matériel", "Communication", "Équipe", "RH", "Rapports", "Portail client", "Assistant IA"];

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json(request, { error: "Non authentifié" }, 401);
    const admin = adminClient();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json(request, { error: "Session invalide" }, 401);
    const { data: caller } = await admin.from("profiles").select("role,roles,active,is_beta_tester,is_platform_owner").eq("id", authData.user.id).single();
    const callerRoles = Array.isArray(caller?.roles) && caller.roles.length ? caller.roles : [caller?.role];
    if (!caller?.active || caller?.is_beta_tester || !caller.is_platform_owner) return json(request, { error: "Seul le propriétaire de la plateforme peut créer ce compte" }, 403);
    const body = await request.json() as { email?: string; password?: string; name?: string };
    const email = body.email?.trim().toLowerCase(), name = body.name?.trim() || "Bêta Testeur SmartSell";
    if (!email || !body.password || body.password.length < 12) return json(request, { error: "E-mail et mot de passe temporaire sécurisé requis (12 caractères minimum)" }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { name, account_type: "BETA_TESTER" } });
    if (error || !data.user) return json(request, { error: error?.message || "Création impossible" }, 400);
    const { error: profileError } = await admin.from("profiles").upsert({ id: data.user.id, full_name: name, role: "SUPER_ADMIN", roles: allRoles, active: true, must_change_password: false, is_beta_tester: true });
    if (profileError) { await admin.auth.admin.deleteUser(data.user.id); return json(request, { error: profileError.message }, 400); }
    await admin.from("user_access_controls").upsert({ profile_id: data.user.id, allowed_modules: allModules, denied_permissions: [], can_initiate_calls: true, max_sms_per_day: 1000, max_emails_per_day: 2500, max_calls_per_day: 100, max_export_rows: 50000, max_approval_amount: 999999999999, updated_by: authData.user.id });
    await admin.from("activity_logs").insert({ actor_id: authData.user.id, action: "CREATE_BETA_TESTER", entity_type: "profile", entity_id: data.user.id, metadata: { email, isolated: true } });
    return json(request, { id: data.user.id, email, isolated: true }, 201);
  } catch (error) { return edgeError(request, error); }
});
