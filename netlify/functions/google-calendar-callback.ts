import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { encryptToken, exchangeGoogleCode } from './_shared/google-calendar'

export default async(request:Request)=>{
  const requestUrl=new URL(request.url),code=requestUrl.searchParams.get('code'),state=requestUrl.searchParams.get('state'),site=process.env.URL||'https://smartsellapps.netlify.app'
  if(!code||!state)return Response.redirect(`${site}/?calendar=error`,302)
  const url=process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key)return Response.redirect(`${site}/?calendar=error`,302)
  const admin=createClient(url,key,{auth:{persistSession:false}}),stateHash=createHash('sha256').update(state).digest('hex')
  const {data:record}=await admin.from('calendar_oauth_states').select('*').eq('state_hash',stateHash).gt('expires_at',new Date().toISOString()).maybeSingle()
  if(!record)return Response.redirect(`${site}/?calendar=invalid_state`,302)
  try{const tokens=await exchangeGoogleCode(code),access=encryptToken(tokens.access_token!),refresh=tokens.refresh_token?encryptToken(tokens.refresh_token):null
    await admin.from('calendar_connections').upsert({profile_id:record.profile_id,provider:'GOOGLE',connected:true,sync_enabled:true,encrypted_access_token:access.value,encrypted_refresh_token:refresh?.value||null,access_token_iv:access.iv,access_token_tag:access.tag,refresh_token_iv:refresh?.iv||null,refresh_token_tag:refresh?.tag||null,token_expires_at:new Date(Date.now()+(tokens.expires_in||3600)*1000).toISOString(),scope:tokens.scope||null,calendar_id:'primary',updated_at:new Date().toISOString()})
    await admin.from('calendar_oauth_states').delete().eq('state_hash',stateHash)
    return Response.redirect(`${site}/?calendar=connected`,302)
  }catch{return Response.redirect(`${site}/?calendar=error`,302)}
}
