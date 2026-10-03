import { adminClient, authenticated, edgeError, handleOptions, json } from '../_shared/http.ts'
import { resolveCanvaWorkspace } from '../_shared/canvaWorkspace.ts'

const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
const decode=(value:string)=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),char=>char.charCodeAt(0))
const digest=async(value:string)=>encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))
const random=()=>encode(crypto.getRandomValues(new Uint8Array(48)))
const required=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error(`${name} non configuré dans les secrets Supabase`);return value}
const redirectUri=()=>Deno.env.get('CANVA_REDIRECT_URI')||`${required('SUPABASE_URL')}/functions/v1/canva-connect`
const appRedirect=(status:string)=>{const destination=new URL(Deno.env.get('APP_URL')||'https://seydoutra.github.io/smartsell-management/');destination.hash=`/Intégrations?canva=${encodeURIComponent(status)}`;return Response.redirect(destination.href,302)}
async function key(){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(required('CANVA_TOKEN_ENCRYPTION_KEY')));return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt'])}
async function encrypt(value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(value));return {value:encode(new Uint8Array(bytes)),iv:encode(iv)}}
async function decrypt(value:string,iv:string){const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv)},await key(),decode(value));return new TextDecoder().decode(bytes)}
async function token(body:URLSearchParams){const response=await fetch('https://api.canva.com/rest/v1/oauth/token',{method:'POST',headers:{authorization:`Basic ${btoa(`${required('CANVA_CLIENT_ID')}:${required('CANVA_CLIENT_SECRET')}`)}`,'content-type':'application/x-www-form-urlencoded'},body});const data=await response.json() as {access_token?:string;refresh_token?:string;expires_in?:number;scope?:string;message?:string};if(!response.ok||!data.access_token||!data.refresh_token)throw new Error(data.message||'Autorisation Canva impossible');return data}
type Connection={profile_id:string;encrypted_access_token:string;encrypted_refresh_token:string;access_token_iv:string;refresh_token_iv:string;token_expires_at:string;scope:string|null}
async function accessToken(connection:Connection){if(new Date(connection.token_expires_at).getTime()>Date.now()+60_000)return decrypt(connection.encrypted_access_token,connection.access_token_iv);const refresh=await decrypt(connection.encrypted_refresh_token,connection.refresh_token_iv);const next=await token(new URLSearchParams({grant_type:'refresh_token',refresh_token:refresh}));const access=await encrypt(next.access_token!),refreshEncrypted=await encrypt(next.refresh_token!);const {error}=await adminClient().from('canva_connections').update({encrypted_access_token:access.value,access_token_iv:access.iv,encrypted_refresh_token:refreshEncrypted.value,refresh_token_iv:refreshEncrypted.iv,token_expires_at:new Date(Date.now()+(next.expires_in||3600)*1000).toISOString(),updated_at:new Date().toISOString()}).eq('profile_id',connection.profile_id);if(error)throw error;return next.access_token!}

async function workspaceAccess(admin:ReturnType<typeof adminClient>,profileId:string){
  const {data:profile,error}=await admin.from('profiles').select('tenant_owner_id,role,roles').eq('id',profileId).single()
  if(error||!profile)throw new Error('Espace Canva introuvable')
  const {data:access,error:accessError}=await admin.from('user_access_controls').select('allowed_modules,denied_permissions').eq('profile_id',profileId).maybeSingle()
  if(accessError)throw accessError
  return resolveCanvaWorkspace(profileId,profile,access)
}

Deno.serve(async(request)=>{
  const options=handleOptions(request);if(options)return options
  const url=new URL(request.url)
  if(request.method==='GET'){
    const code=url.searchParams.get('code'),state=url.searchParams.get('state')
    if(!code||!state)return appRedirect('cancelled')
    try{
      const admin=adminClient(),stateHash=await digest(state)
      const {data:record,error}=await admin.from('canva_oauth_states').select('profile_id,code_verifier').eq('state_hash',stateHash).gt('expires_at',new Date().toISOString()).maybeSingle()
      if(error||!record)return appRedirect('invalid_state')
      await admin.from('canva_oauth_states').delete().eq('state_hash',stateHash)
      const received=await token(new URLSearchParams({grant_type:'authorization_code',code,code_verifier:record.code_verifier,redirect_uri:redirectUri()}))
      const access=await encrypt(received.access_token!),refresh=await encrypt(received.refresh_token!)
      const {error:saveError}=await admin.from('canva_connections').upsert({profile_id:record.profile_id,encrypted_access_token:access.value,access_token_iv:access.iv,encrypted_refresh_token:refresh.value,refresh_token_iv:refresh.iv,token_expires_at:new Date(Date.now()+(received.expires_in||3600)*1000).toISOString(),scope:received.scope||null,updated_at:new Date().toISOString()})
      if(saveError)throw saveError
      return appRedirect('connected')
    }catch(error){console.error('Canva callback failed',error);return appRedirect('error')}
  }
  if(request.method!=='POST')return json(request,{error:'Méthode non autorisée'},405)
  try{
    const {admin,user}=await authenticated(request)
    const {action,design_id}=await request.json() as {action:'start'|'status'|'designs'|'design'|'disconnect';design_id?:string}
    const workspace=await workspaceAccess(admin,user.id)
    if(action==='start'){
      if(!workspace.isOwner)return json(request,{error:'Seul le propriétaire de cet espace peut connecter Canva.'},403)
      const clientId=required('CANVA_CLIENT_ID');required('CANVA_CLIENT_SECRET');required('CANVA_TOKEN_ENCRYPTION_KEY')
      const state=random(),verifier=random(),challenge=await digest(verifier)
      const {error}=await admin.from('canva_oauth_states').insert({state_hash:await digest(state),profile_id:user.id,code_verifier:verifier,expires_at:new Date(Date.now()+10*60_000).toISOString()})
      if(error)throw error
      const params=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri(),response_type:'code',scope:'design:meta:read',code_challenge:challenge,code_challenge_method:'s256',state})
      return json(request,{url:`https://www.canva.com/api/oauth/authorize?${params}`})
    }
    const {data:connection,error}=await admin.from('canva_connections').select('*').eq('profile_id',workspace.tenantOwnerId).maybeSingle()
    if(error)throw error
    if(action==='status')return json(request,{connected:workspace.canView&&!!connection,configured:!!(Deno.env.get('CANVA_CLIENT_ID')&&Deno.env.get('CANVA_CLIENT_SECRET')&&Deno.env.get('CANVA_TOKEN_ENCRYPTION_KEY')),canManage:workspace.isOwner,shared:!workspace.isOwner})
    if(action==='disconnect'){
      if(!workspace.isOwner)return json(request,{error:'Seul le propriétaire de cet espace peut déconnecter Canva.'},403)
      if(connection){const {error:removeError}=await admin.from('canva_connections').delete().eq('profile_id',workspace.tenantOwnerId);if(removeError)throw removeError}
      return json(request,{connected:false})
    }
    if(!workspace.canView)return json(request,{error:'Accès au calendrier éditorial non autorisé.'},403)
    if(action==='designs'){
      if(!connection)return json(request,{error:'Connectez d’abord votre compte Canva.'},409)
      const bearer=await accessToken(connection as Connection)
      const response=await fetch('https://api.canva.com/rest/v1/designs?limit=50',{headers:{authorization:`Bearer ${bearer}`}})
      const data=await response.json() as {items?:Array<{id:string;title:string;thumbnail?:{url:string};urls?:{edit_url?:string;view_url?:string};updated_at?:number}>;message?:string}
      if(!response.ok)throw new Error(data.message||'Liste Canva indisponible')
      return json(request,{items:(data.items||[]).map(item=>({id:item.id,title:item.title,thumbnail:item.thumbnail?.url||null,edit_url:item.urls?.edit_url||null,view_url:item.urls?.view_url||null,updated_at:item.updated_at||null}))})
    }
    if(action==='design'){
      if(!connection)return json(request,{error:'Connectez d’abord votre compte Canva.'},409)
      if(!design_id||!/^[A-Za-z0-9_-]{5,100}$/.test(design_id))return json(request,{error:'Identifiant Canva invalide'},400)
      const bearer=await accessToken(connection as Connection)
      const response=await fetch(`https://api.canva.com/rest/v1/designs/${encodeURIComponent(design_id)}`,{headers:{authorization:`Bearer ${bearer}`}})
      const data=await response.json() as {design?:{id:string;title:string;urls?:{edit_url?:string;view_url?:string}};message?:string}
      if(!response.ok||!data.design)throw new Error(data.message||'Design Canva inaccessible avec ce compte')
      return json(request,{id:data.design.id,title:data.design.title,edit_url:data.design.urls?.edit_url||null,view_url:data.design.urls?.view_url||null})
    }
    return json(request,{error:'Action inconnue'},400)
  }catch(error){return edgeError(request,error)}
})
