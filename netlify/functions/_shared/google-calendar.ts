import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

type Connection={encrypted_access_token?:string|null;encrypted_refresh_token?:string|null;access_token_iv?:string|null;access_token_tag?:string|null;refresh_token_iv?:string|null;refresh_token_tag?:string|null;token_expires_at?:string|null;calendar_id?:string|null}

const encryptionKey=()=>{
  const raw=process.env.CALENDAR_TOKEN_ENCRYPTION_KEY||''
  if(!raw) throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY manquante')
  return createHash('sha256').update(raw).digest()
}

export function encryptToken(value:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return {value:encrypted.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64')}}
export function decryptToken(value:string,iv:string,tag:string){const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'base64'));decipher.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(value,'base64')),decipher.final()]).toString('utf8')}

export async function exchangeGoogleCode(code:string){const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',redirect_uri:process.env.GOOGLE_REDIRECT_URI||'',grant_type:'authorization_code'})});const data=await response.json() as {access_token?:string;refresh_token?:string;expires_in?:number;scope?:string;error_description?:string};if(!response.ok||!data.access_token)throw new Error(data.error_description||'Connexion Google impossible');return data}

export async function getGoogleAccessToken(connection:Connection){
  if(connection.encrypted_access_token&&connection.access_token_iv&&connection.access_token_tag&&connection.token_expires_at&&new Date(connection.token_expires_at).getTime()>Date.now()+60_000)return decryptToken(connection.encrypted_access_token,connection.access_token_iv,connection.access_token_tag)
  if(!connection.encrypted_refresh_token||!connection.refresh_token_iv||!connection.refresh_token_tag)throw new Error('Reconnexion Google requise')
  const refreshToken=decryptToken(connection.encrypted_refresh_token,connection.refresh_token_iv,connection.refresh_token_tag)
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({refresh_token:refreshToken,client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',grant_type:'refresh_token'})})
  const data=await response.json() as {access_token?:string;expires_in?:number;error_description?:string};if(!response.ok||!data.access_token)throw new Error(data.error_description||'Actualisation Google impossible');return data.access_token
}

export async function createGoogleEvent(accessToken:string,calendarId:string,event:{title:string;description?:string|null;start:string;reminderMinutes:number}){const start=new Date(event.start),end=new Date(start.getTime()+60*60_000);const response=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId||'primary')}/events`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${accessToken}`},body:JSON.stringify({summary:event.title,description:event.description||'Tâche SmartSell',start:{dateTime:start.toISOString(),timeZone:'Africa/Conakry'},end:{dateTime:end.toISOString(),timeZone:'Africa/Conakry'},reminders:{useDefault:false,overrides:[{method:'popup',minutes:event.reminderMinutes},{method:'email',minutes:event.reminderMinutes}]},extendedProperties:{private:{source:'smartsell'}}})});const data=await response.json() as {id?:string;error?:{message?:string}};if(!response.ok||!data.id)throw new Error(data.error?.message||'Création de l’événement Google impossible');return data.id}
