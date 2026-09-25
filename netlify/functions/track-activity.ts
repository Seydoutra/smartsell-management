import { createClient } from '@supabase/supabase-js'

export default async (request:Request)=>{
  if(request.method!=='POST')return new Response('Method not allowed',{status:405})
  const url=process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key)return Response.json({error:'Configuration manquante'},{status:500})
  const admin=createClient(url,key,{auth:{persistSession:false}}),token=request.headers.get('authorization')?.replace('Bearer ','')
  if(!token)return Response.json({error:'Non authentifié'},{status:401})
  const {data:auth}=await admin.auth.getUser(token);if(!auth.user)return Response.json({error:'Session invalide'},{status:401})
  const body=await request.json() as {action:string;entityType:string;entityId?:string;metadata?:Record<string,unknown>;sessionId?:string}
  const allowed=['LOGIN','LOGOUT','HEARTBEAT','PAGE_VIEW','CREATE','UPDATE','DELETE','EXPORT','SEND_SMS','SEND_EMAIL','INITIATE_CALL','CHANGE_PERMISSION']
  if(!allowed.includes(body.action))return Response.json({error:'Action inconnue'},{status:400})
  const {error}=await admin.from('activity_logs').insert({actor_id:auth.user.id,action:body.action,entity_type:body.entityType,entity_id:body.entityId||null,metadata:body.metadata||{}})
  if(body.sessionId){const now=new Date().toISOString();if(body.action==='LOGIN')await admin.from('user_sessions').upsert({id:body.sessionId,profile_id:auth.user.id,signed_in_at:now,last_seen_at:now});else{const {data:s}=await admin.from('user_sessions').select('active_seconds,pages_viewed').eq('id',body.sessionId).maybeSingle();await admin.from('user_sessions').update({last_seen_at:now,active_seconds:(s?.active_seconds||0)+(body.action==='HEARTBEAT'?60:0),pages_viewed:(s?.pages_viewed||0)+(body.action==='PAGE_VIEW'?1:0),...(body.action==='LOGOUT'?{signed_out_at:now}:{})}).eq('id',body.sessionId).eq('profile_id',auth.user.id)}}
  return error?Response.json({error:error.message},{status:400}):Response.json({ok:true})
}
