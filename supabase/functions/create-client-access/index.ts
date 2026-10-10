import { authenticated, edgeError, handleOptions, json, requireActions } from "../_shared/http.ts";
import { sendWelcomeEmail, sendWelcomeSms } from "../_shared/welcome.ts";
import type { DeliveryResult } from "../_shared/welcome.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    await requireActions(admin,user.id,['portal.create']);
    const { data: caller } = await admin.from("profiles").select("role,roles,active,tenant_owner_id").eq("id", user.id).single();
    const callerRoles = Array.isArray(caller?.roles) && caller.roles.length ? caller.roles : [caller?.role];
    if (!caller?.active || !callerRoles.some((role) => ["SUPER_ADMIN", "ADMIN"].includes(role))) return json(request, { error: "Permission refusée" }, 403);
    const body = await request.json() as { client_id?: string; password?: string; notify_email?: boolean; notify_sms?: boolean };
    if (!body.client_id || !body.password || body.password.length < 8) return json(request, { error: "Client et mot de passe temporaire de 8 caractères minimum requis" }, 400);
    const tenant=caller.tenant_owner_id||user.id;
    const { data: client, error: clientError } = await admin.from("clients").select("id,name,email,phone").eq("tenant_owner_id",tenant).eq("id", body.client_id).single();
    if (clientError || !client?.email) return json(request, { error: "La fiche client doit contenir une adresse e-mail valide" }, 400);
    const email = String(client.email).trim().toLowerCase();
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { name: client.name, account_type: "CLIENT" } });
    if (createError || !created.user) return json(request, { error: createError?.message || "Création du compte client impossible" }, 400);
    const profileId = created.user.id;
    const { error: profileError } = await admin.from("profiles").upsert({ id: profileId, tenant_owner_id:tenant, full_name: client.name, phone: client.phone || null, role: "CLIENT", roles: ["CLIENT"], active: true, must_change_password: true });
    if (profileError) { await admin.auth.admin.deleteUser(profileId); return json(request, { error: profileError.message }, 400); }
    const { error: accessError } = await admin.from("client_portal_access").upsert({ profile_id: profileId, tenant_owner_id:tenant, client_id: client.id, can_view_finance: true, can_comment: true, active: true });
    if (accessError) { await admin.auth.admin.deleteUser(profileId); return json(request, { error: accessError.message }, 400); }
    const loginUrl = Deno.env.get("APP_LOGIN_URL") || "https://seydoutra.github.io/smartsell-management/";
    const welcome = { name: client.name, email, phone: client.phone, temporaryPassword: body.password, loginUrl };
    const deliveries: DeliveryResult[] = [];
    if (body.notify_email !== false) deliveries.push(await sendWelcomeEmail(welcome).catch(() => ({ channel: "EMAIL", status: "FAILED", detail: "Envoi impossible" } as DeliveryResult)));
    if (body.notify_sms !== false) deliveries.push(await sendWelcomeSms(welcome).catch((error) => ({ channel: "SMS", status: "FAILED", detail: error instanceof Error ? error.message : "Envoi impossible" } as DeliveryResult)));
    await admin.from("activity_logs").insert({ actor_id: user.id, action: "CREATE", entity_type: "client_portal_access", entity_id: client.id, metadata: { email, profile_id: profileId } });
    return json(request, { id: profileId, deliveries }, 201);
  } catch (error) { return edgeError(request, error); }
});
