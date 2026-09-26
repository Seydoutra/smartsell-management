import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";
import { sendWelcomeEmail, sendWelcomeSms } from "../_shared/welcome.ts";
import type { DeliveryResult } from "../_shared/welcome.ts";

const roles = new Set(["ADMIN", "MANAGER", "CHEF_DE_PROJET", "COMMERCIAL", "COMMUNITY_MANAGER", "GRAPHISTE", "VIDEASTE", "PHOTOGRAPHE", "DEVELOPPEUR", "COMPTABLE", "COLLABORATEUR"]);
const rolePriority = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CHEF_DE_PROJET", "COMMERCIAL", "COMMUNITY_MANAGER", "COMPTABLE", "DEVELOPPEUR", "GRAPHISTE", "VIDEASTE", "PHOTOGRAPHE", "COLLABORATEUR"];

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    const { data: caller } = await admin.from("profiles").select("role,roles,active").eq("id", user.id).single();
    const callerRoles = Array.isArray(caller?.roles) && caller.roles.length ? caller.roles : [caller?.role];
    if (!caller?.active || !callerRoles.some((role) => ["SUPER_ADMIN", "ADMIN"].includes(role))) return json(request, { error: "Permission refusée" }, 403);
    const body = await request.json() as { email?: string; password?: string; name?: string; phone?: string; roles?: string[]; role?: string; department_id?: string; notify_email?: boolean; notify_sms?: boolean };
    const email = body.email?.trim().toLowerCase(), name = body.name?.trim();
    const selectedRoles = [...new Set((Array.isArray(body.roles) ? body.roles : [body.role]).filter((role): role is string => Boolean(role)).map((role) => role.trim()))];
    if (!email || !name || !selectedRoles.length || selectedRoles.some((role) => !roles.has(role))) return json(request, { error: "Nom, e-mail et rôles valides requis" }, 400);
    const role = rolePriority.find((candidate) => selectedRoles.includes(candidate)) || "COLLABORATEUR";
    if (!body.password || body.password.length < 8) return json(request, { error: "Le mot de passe temporaire doit contenir au moins 8 caractères" }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { name } });
    if (error || !data.user) return json(request, { error: error?.message || "Création impossible" }, 400);
    const { error: profileError } = await admin.from("profiles").upsert({ id: data.user.id, full_name: name, phone: body.phone?.trim() || null, role, roles: selectedRoles, department_id: body.department_id || null, active: true, must_change_password: true });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json(request, { error: `Profil non créé : ${profileError.message}` }, 400);
    }
    const loginUrl = Deno.env.get("APP_LOGIN_URL") || "https://seydoutra.github.io/smartsell-management/";
    const welcome = { name, email, phone: body.phone, temporaryPassword: body.password, loginUrl };
    const deliveries: DeliveryResult[] = [];
    if (body.notify_email !== false) deliveries.push(await sendWelcomeEmail(welcome).catch(() => ({ channel: "EMAIL", status: "FAILED", detail: "Envoi impossible" } as DeliveryResult)));
    if (body.notify_sms !== false) deliveries.push(await sendWelcomeSms(welcome).catch((error) => ({ channel: "SMS", status: "FAILED", detail: error instanceof Error ? error.message : "Envoi impossible" } as DeliveryResult)));
    const smsDelivery = deliveries.find((delivery) => delivery.channel === "SMS");
    if (smsDelivery) await admin.from("communication_logs").insert({ channel: "SMS", recipient: body.phone?.trim() || "", status: smsDelivery.status === "SENT" ? "SENT" : "FAILED", provider_message_id: smsDelivery.providerMessageId || null, sms_cost: smsDelivery.messageCost || null, sms_currency: smsDelivery.currency || null, sent_by: user.id, metadata: { provider: "NIMBA", purpose: "WELCOME", detail: smsDelivery.detail || null } });
    await admin.from("activity_logs").insert({ actor_id: user.id, action: "CREATE", entity_type: "profile", entity_id: data.user.id, metadata: { email, roles: selectedRoles, welcome_delivery: deliveries.map(({ channel, status }) => ({ channel, status })) } });
    return json(request, { id: data.user.id, deliveries }, 201);
  } catch (error) { return edgeError(request, error); }
});
