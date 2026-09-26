import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request,{error:"Méthode non autorisée"},405);
  try {
    const { admin, user } = await authenticated(request);
    const { profile_id } = await request.json() as { profile_id?:string };
    if (!profile_id) return json(request,{error:"Utilisateur manquant"},400);
    if (profile_id === user.id) return json(request,{error:"Vous ne pouvez pas supprimer votre propre compte."},400);
    const { data: actor } = await admin.from("profiles").select("role,roles").eq("id",user.id).single();
    const roles = (actor?.roles?.length ? actor.roles : [actor?.role]) as string[];
    if (!roles.includes("SUPER_ADMIN")) return json(request,{error:"Seul le super administrateur peut supprimer un utilisateur."},403);
    const { data: target } = await admin.from("profiles").select("full_name,role,roles").eq("id",profile_id).single();
    const targetRoles = (target?.roles?.length ? target.roles : [target?.role]) as string[];
    if (targetRoles.includes("SUPER_ADMIN")) return json(request,{error:"La suppression d’un autre super administrateur est bloquée par sécurité."},403);
    await admin.from("activity_logs").insert({actor_id:user.id,action:"DELETE",entity_type:"profile",entity_id:profile_id,metadata:{full_name:target?.full_name||"Utilisateur"}});
    const { error } = await admin.auth.admin.deleteUser(profile_id);
    if (error) throw error;
    return json(request,{success:true});
  } catch (error) { return edgeError(request,error); }
});
