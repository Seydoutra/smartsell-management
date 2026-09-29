import { authenticated, handleOptions, json } from '../_shared/http.ts';
import { sendNimbaSms } from '../_shared/nimba.ts';

Deno.serve(async request => {
 const options=handleOptions(request); if(options)return options;
 if(request.method!=='POST')return json(request,{error:'Méthode non autorisée'},405);
 try {
  const {admin,user}=await authenticated(request);
  const {data:actor,error}=await admin.from('profiles').select('id,tenant_owner_id,is_platform_owner').eq('id',user.id).single();
  if(error||!actor)return json(request,{error:'Profil indisponible'},403);
  const body=await request.json();
  const ownTenant=actor.tenant_owner_id||actor.id;
  const tenant=actor.is_platform_owner ? body.tenant_owner_id||ownTenant : ownTenant;
  const {data:target}=await admin.from('profiles').select('id,tenant_owner_id').eq('id',tenant).single();
  if(!target||target.tenant_owner_id!==target.id)return json(request,{error:'Entreprise introuvable'},400);
  const mode=body.mode||'get';
  if(mode==='save'||mode==='test') {
   if(!actor.is_platform_owner)return json(request,{error:'Configuration réservée au propriétaire de la plateforme'},403);
   if(mode==='save') {
    const status=String(body.status||'CONFIGURED'),sender=String(body.sender_name||'').trim(),organization=String(body.organization_name||'').trim();
    if(!['CONFIGURED','ACTIVE','PAUSED'].includes(status)||!sender||sender.length>50||!organization||organization.length>150)return json(request,{error:'Organisation et expéditeur Nimba requis'},400);
    const {error:saveError}=await admin.from('tenant_sms_settings').upsert({tenant_owner_id:tenant,organization_name:organization,sender_name:sender,status:'CONFIGURED',updated_at:new Date().toISOString()});
    if(saveError)throw saveError;
    const {error:secretError}=await admin.rpc('save_tenant_sms_credentials',{p_tenant:tenant,p_sid:String(body.service_id||'').trim(),p_token:String(body.secret_token||'').trim()});
    if(secretError)throw secretError;
    const {data:stored}=await admin.from('tenant_sms_settings').select('sid_secret_id,token_secret_id').eq('tenant_owner_id',tenant).single();
    if(status==='ACTIVE'&&(!stored?.sid_secret_id||!stored?.token_secret_id))return json(request,{error:'Renseignez les deux identifiants Nimba avant activation'},400);
    const {error:updateError}=await admin.from('tenant_sms_settings').update({status}).eq('tenant_owner_id',tenant);
    if(updateError)throw updateError;
   } else {
    const phone=String(body.phone||'').replace(/\D/g,'');
    if(phone.length<9||phone.length>15)return json(request,{error:'Numéro de test invalide'},400);
    await sendNimbaSms([phone],'Votre connexion SMS est opérationnelle. Ceci est un test de configuration.',tenant);
    return json(request,{message:'SMS accepté par Nimba. Vérifiez sa réception sur le téléphone.'});
   }
  } else if(mode==='request') {
   if(user.id!==ownTenant&&!actor.is_platform_owner)return json(request,{error:'Demande réservée à l’administrateur de votre entreprise'},403);
   const {error:requestError}=await admin.from('tenant_sms_settings').upsert({tenant_owner_id:tenant,status:'REQUESTED'},{onConflict:'tenant_owner_id',ignoreDuplicates:true});
   if(requestError)throw requestError;
  } else if(mode!=='get')return json(request,{error:'Action inconnue'},400);
  const {data:settings,error:readError}=await admin.from('tenant_sms_settings').select('tenant_owner_id,organization_name,sender_name,status,updated_at,sid_secret_id,token_secret_id').eq('tenant_owner_id',tenant).maybeSingle();
  if(readError)throw readError;
  let tenants:unknown[]=[];
  if(actor.is_platform_owner){const {data:profiles,error:profilesError}=await admin.from('profiles').select('id,full_name,tenant_owner_id').order('full_name');if(profilesError)throw profilesError;tenants=(profiles||[]).filter(p=>p.id===p.tenant_owner_id).map(p=>({id:p.id,name:p.full_name}));}
  const {data:trial,error:trialError}=await admin.rpc('trial_sms_status',{p_tenant:tenant});
  if(trialError)throw trialError;
  return json(request,{can_manage:actor.is_platform_owner,tenant_owner_id:tenant,tenants,trial,settings:settings?{organization_name:settings.organization_name,sender_name:settings.sender_name,status:settings.status,updated_at:settings.updated_at,credentials_saved:!!(settings.sid_secret_id&&settings.token_secret_id)}:null});
 }catch(error){if(error instanceof Response)return error;return json(request,{error:'Configuration SMS indisponible. Vérifiez que le service et sa migration sont installés.'},500);}
});
