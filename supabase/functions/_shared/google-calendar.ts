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

export async function createGoogleEvent(accessToken: string, calendarId: string, event: { title: string; description?: string | null; start: string; reminderMinutes: number }) {
  const start = new Date(event.start), end = new Date(start.getTime() + 60 * 60_000);
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ summary: event.title, description: event.description || "Tâche SmartSell", start: { dateTime: start.toISOString(), timeZone: "Africa/Conakry" }, end: { dateTime: end.toISOString(), timeZone: "Africa/Conakry" }, reminders: { useDefault: false, overrides: [{ method: "popup", minutes: event.reminderMinutes }, { method: "email", minutes: event.reminderMinutes }] }, extendedProperties: { private: { source: "smartsell" } } }) });
  const data = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) throw new Error(data.error?.message || "Création de l’événement Google impossible");
  return data.id;
}
