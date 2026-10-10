import {adminClient,json} from '../_shared/http.ts';
import {sendNimbaSms} from '../_shared/nimba.ts';
export async function processEquipmentDecisions(admin:ReturnType<typeof adminClient>,send=sendNimbaSms){
 const {data:rows,error}=await admin.rpc('claim_equipment_decision_sms');if(error)throw error;
 let sent=0,failed=0,cancelled=0;
 for(const row of rows||[]){
  const {data:profile,error:profileError}=await admin.from('profiles').select('phone,active,tenant_owner_id').eq('id',row.profile_id).maybeSingle();
  if(profileError||!profile?.active||profile.tenant_owner_id!==row.tenant_owner_id){
   await admin.from('equipment_decision_sms').update({status:'CANCELLED',error:'Destinataire inactif ou entreprise différente'}).eq('id',row.id);cancelled++;continue;
  }
  let providerId:string|null=null;
  try{
   const phone=Deno.env.get('COMMUNICATION_TEST_MODE')==='true'?Deno.env.get('COMMUNICATION_TEST_PHONE'):profile.phone;
   if(!phone)throw new Error('Numéro de téléphone du demandeur manquant');
   const result=await send([phone],row.body,row.tenant_owner_id);providerId=result.uid||result.id||null;
  }catch(caught){
   const detail=caught instanceof Error?caught.message:'Envoi SMS impossible';
   const {error:saveError}=await admin.from('equipment_decision_sms').update({status:'FAILED',error:detail}).eq('id',row.id);if(saveError)throw saveError;
   await admin.from('notifications').insert({tenant_owner_id:row.tenant_owner_id,profile_id:row.tenant_owner_id,channel:'IN_APP',title:'SMS de décision matériel non envoyé',body:`Bon ${row.request_id.slice(0,8)} : ${detail}`,entity_type:'equipment_request',entity_id:row.request_id});failed++;continue;
  }
  // No automatic retry after provider acceptance: avoid billing duplicate SMS after a DB outage.
  const {error:saveError}=await admin.from('equipment_decision_sms').update({status:'SENT',sent_at:new Date().toISOString(),provider_message_id:providerId,error:null}).eq('id',row.id);if(saveError)throw saveError;
  sent++;
 }
 return {processed:rows?.length||0,sent,failed,cancelled};
}
Deno.serve(async request=>{
 const bearer=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 const secret=Deno.env.get('CRON_SECRET');
 if(!((bearer&&bearer===Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))||(secret&&request.headers.get('x-cron-secret')===secret)))return json(request,{error:'Non autorisé'},401);
 try{return json(request,await processEquipmentDecisions(adminClient()))}
 catch(error){return json(request,{error:error instanceof Error?error.message:'Traitement indisponible'},500)}
});
