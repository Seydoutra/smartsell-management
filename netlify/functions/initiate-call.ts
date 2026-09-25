import { createClient } from '@supabase/supabase-js'

export default async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const url=process.env.VITE_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key) return Response.json({error:'Configuration Supabase manquante'},{status:500})
  const admin=createClient(url,key,{auth:{persistSession:false}})
  const token=request.headers.get('authorization')?.replace('Bearer ','')
  if(!token) return Response.json({error:'Non authentifié'},{status:401})
  const {data:auth}=await admin.auth.getUser(token)
  if(!auth.user) return Response.json({error:'Session invalide'},{status:401})
  const {data:profile}=await admin.from('profiles').select('role').eq('id',auth.user.id).single()
  const {data:access}=await admin.from('user_access_controls').select('can_initiate_calls,max_calls_per_day').eq('profile_id',auth.user.id).maybeSingle()
  if(!access?.can_initiate_calls && !['SUPER_ADMIN','ADMIN','MANAGER','COMMERCIAL'].includes(profile?.role||'')) return Response.json({error:'Appels non autorisés pour cet utilisateur'},{status:403})
  const start=new Date();start.setHours(0,0,0,0)
  const {count}=await admin.from('call_logs').select('id',{count:'exact',head:true}).eq('initiated_by',auth.user.id).gte('created_at',start.toISOString())
  const limit=access?.max_calls_per_day ?? Number(process.env.MAX_CALLS_PER_DAY||20)
  if((count||0)>=limit) return Response.json({error:`Limite quotidienne de ${limit} appels atteinte`},{status:429})
  if(process.env.COMMUNICATION_TEST_MODE!=='false') return Response.json({status:'TEST_MODE',message:'Appel simulé et journalisé sans contacter le destinataire'})
  if(!process.env.VOICE_API_URL||!process.env.VOICE_API_KEY) return Response.json({error:'Fournisseur téléphonique non configuré'},{status:503})
  return Response.json({status:'QUEUED',message:'Appel placé dans la file du fournisseur'})
}
