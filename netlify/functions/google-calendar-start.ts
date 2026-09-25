import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export default async(request:Request)=>{
  if(request.method!=='POST')return new Response('Method not allowed',{status:405})
  const url=process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,token=request.headers.get('authorization')?.replace('Bearer ','')
  if(!url||!key||!token)return Response.json({error:'Session manquante'},{status:401})
  const admin=createClient(url,key,{auth:{persistSession:false}}),{data:auth}=await admin.auth.getUser(token)
  if(!auth.user)return Response.json({error:'Session invalide'},{status:401})
  if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_REDIRECT_URI)return Response.json({error:'Google Agenda n’est pas encore configuré'},{status:503})
  const state=randomBytes(32).toString('base64url'),stateHash=createHash('sha256').update(state).digest('hex')
  await admin.from('calendar_oauth_states').insert({state_hash:stateHash,profile_id:auth.user.id,expires_at:new Date(Date.now()+10*60_000).toISOString()})
  const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:process.env.GOOGLE_REDIRECT_URI,response_type:'code',access_type:'offline',prompt:'consent',scope:'openid email https://www.googleapis.com/auth/calendar.events',state})
  return Response.json({url:`https://accounts.google.com/o/oauth2/v2/auth?${params}`})
}
