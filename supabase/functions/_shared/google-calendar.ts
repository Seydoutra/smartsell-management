type Connection = { encrypted_access_token?: string | null; encrypted_refresh_token?: string | null; access_token_iv?: string | null; refresh_token_iv?: string | null; token_expires_at?: string | null; calendar_id?: string | null };

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
async function encryptionKey() {
  const raw = Deno.env.get("CALENDAR_TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY manquante");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return { value: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv), tag: "webcrypto" };
}

export async function decryptToken(value: string, iv: string) {
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, await encryptionKey(), base64ToBytes(value));
  return new TextDecoder().decode(decrypted);
}

export async function exchangeGoogleCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "", client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "", redirect_uri: Deno.env.get("GOOGLE_REDIRECT_URI") || "", grant_type: "authorization_code" }) });
  const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "Connexion Google impossible");
  return data;
}

export async function getGoogleAccessToken(connection: Connection) {
  if (connection.encrypted_access_token && connection.access_token_iv && connection.token_expires_at && new Date(connection.token_expires_at).getTime() > Date.now() + 60_000) return decryptToken(connection.encrypted_access_token, connection.access_token_iv);
  if (!connection.encrypted_refresh_token || !connection.refresh_token_iv) throw new Error("Reconnexion Google requise");
  const refreshToken = await decryptToken(connection.encrypted_refresh_token, connection.refresh_token_iv);
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ refresh_token: refreshToken, client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "", client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "", grant_type: "refresh_token" }) });
  const data = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "Actualisation Google impossible");
  return data.access_token;
}

export async function createGoogleEvent(accessToken: string, calendarId: string, event: { taskId?: string; eventKey?: string; title: string; description?: string | null; start: string; reminderMinutes: number }) {
  const eventId = event.eventKey ? `sm${event.eventKey.replaceAll('-', '')}` : event.taskId ? `sm${event.taskId.replaceAll('-', '')}` : undefined;
  const start = new Date(event.start), end = new Date(start.getTime() + 60 * 60_000);
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events`;
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ id: eventId, summary: event.title, description: event.description || "Tâche SmartSell", start: { dateTime: start.toISOString(), timeZone: "Africa/Conakry" }, end: { dateTime: end.toISOString(), timeZone: "Africa/Conakry" }, reminders: { useDefault: false, overrides: [{ method: "popup", minutes: event.reminderMinutes }, { method: "email", minutes: event.reminderMinutes }] }, extendedProperties: { private: { source: "smartsell", ...(event.taskId ? {taskId:event.taskId} : {}) } } }) });
  if (response.status === 409 && eventId) {
    const existing = await fetch(`${endpoint}/${eventId}`, { headers: { authorization: `Bearer ${accessToken}` } });
    const saved = await existing.json() as {id?: string; extendedProperties?: {private?: {source?: string; taskId?: string}}};
    if (existing.ok && saved.id === eventId && saved.extendedProperties?.private?.source === 'smartsell' && saved.extendedProperties.private.taskId === event.taskId) return eventId;
    throw new Error('Événement Google existant non reconnu');
  }
  const data = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) throw new Error(data.error?.message || "Création de l’événement Google impossible");
  return data.id;
}

export async function ownedEvent(accessToken:string,calendarId:string,eventId:string,taskId:string){
 const endpoint=`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId||'primary')}/events/${encodeURIComponent(eventId)}`;
 const response=await fetch(endpoint,{headers:{authorization:`Bearer ${accessToken}`}});
 if(response.status===404||response.status===410)return null;
 const data=await response.json();
 if(!response.ok)throw new Error(data.error?.message||'Lecture de l’événement Google impossible');
 if(data.status==='cancelled')return null;
 if(data.extendedProperties?.private?.source!=='smartsell'||data.extendedProperties.private.taskId!==taskId)throw new Error('Événement Google non reconnu : modification refusée');
 return {endpoint,data};
}
export async function updateGoogleEvent(accessToken:string,calendarId:string,eventId:string,event:{taskId:string;title:string;description?:string|null;start:string;reminderMinutes:number},expectedEtag?:string){
 const saved=await ownedEvent(accessToken,calendarId,eventId,event.taskId);
 if(!saved)throw new Error('Événement Google absent : reconnexion du planning requise');
 if(expectedEtag && saved.data.etag!==expectedEtag)throw new Error('Google a changé pendant la synchronisation : réessayez');
 const start=new Date(event.start),end=new Date(start.getTime()+60*60_000);
 const response=await fetch(saved.endpoint+'?sendUpdates=none',{method:'PATCH',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json',...(saved.data.etag?{'if-match':saved.data.etag}:{})},body:JSON.stringify({summary:event.title,description:event.description||'Tâche Smartsell Management',start:{dateTime:start.toISOString(),timeZone:'Africa/Conakry'},end:{dateTime:end.toISOString(),timeZone:'Africa/Conakry'},reminders:{useDefault:false,overrides:[{method:'popup',minutes:event.reminderMinutes},{method:'email',minutes:event.reminderMinutes}]}})});
 if(!response.ok)throw new Error('Mise à jour Google impossible : '+response.status);
 return eventId;
}
export async function deleteGoogleEvent(accessToken:string,calendarId:string,eventId:string,taskId:string){
 const saved=await ownedEvent(accessToken,calendarId,eventId,taskId);
 if(!saved)return;
 const response=await fetch(saved.endpoint+'?sendUpdates=none',{method:'DELETE',headers:{authorization:`Bearer ${accessToken}`,...(saved.data.etag?{'if-match':saved.data.etag}:{})}});
 if(!response.ok&&response.status!==404&&response.status!==410)throw new Error('Suppression Google impossible : '+response.status);
}
