import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request,{error:"Méthode non autorisée"},405);
  try {
    const { admin, user } = await authenticated(request);
    const { profile_id } = await request.json() as { profile_id?:string };
    if (!profile_id) return json(request,{error:"Utilisateur manquant"},400);
    if (profile_id === user.id) return json(request,{error:"Vous ne pouvez pas supprimer votre propre compte."},400);
    const { data: actor } = await admin.from("profiles").select("active,tenant_owner_id,is_platform_owner").eq("id",user.id).single();
    if (!actor?.active || (!actor.is_platform_owner && actor.tenant_owner_id!==user.id)) return json(request,{error:"Seul le propriétaire peut supprimer un utilisateur."},403);
    const { data: target } = await admin.from("profiles").select("full_name,tenant_owner_id,is_platform_owner").eq("id",profile_id).single();
    if (!target) return json(request,{error:"Utilisateur introuvable."},404);
    if(target.is_platform_owner||(!actor.is_platform_owner&&target.tenant_owner_id!==actor.tenant_owner_id))return json(request,{error:'Suppression hors de votre espace interdite.'},403);
    const { error: prepareError } = await admin.rpc("prepare_user_deletion",{
      target_profile_id: profile_id,
      acting_profile_id: user.id,
    });
    if (prepareError) throw prepareError;
    await admin.from("activity_logs").insert({actor_id:user.id,action:"DELETE",entity_type:"profile",entity_id:profile_id,metadata:{full_name:target?.full_name||"Utilisateur",deletion_mode:"SAFE_REASSIGN"}});
    const { error } = await admin.auth.admin.deleteUser(profile_id);
    if (error) throw error;
    return json(request,{success:true});
  } catch (error) { return edgeError(request,error); }
});
