import { adminClient, requireActions } from "../_shared/http.ts";
import { encryptToken, exchangeGoogleCode } from "../_shared/google-calendar.ts";

const hex = (bytes: Uint8Array) => [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");

Deno.serve(async (request) => {
  const url = new URL(request.url), code = url.searchParams.get("code"), state = url.searchParams.get("state");
  const appUrl = Deno.env.get("APP_URL") || "https://seydoutra.github.io/smartsell-management/";
  const redirectToApp = (status: string) => {
    const destination = new URL(appUrl);
    destination.hash = `/Planning?calendar=${encodeURIComponent(status)}`;
    return Response.redirect(destination.href, 302);
  };
  if (!code || !state) return redirectToApp("error");
  try {
    const admin = adminClient();
    const stateHash = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state))));
    const { data: record, error:stateError } = await admin.from("calendar_oauth_states").delete().eq("state_hash", stateHash).gt("expires_at", new Date().toISOString()).select("profile_id").maybeSingle();
    if (stateError) throw stateError;
    if (!record) return redirectToApp("invalid_state");
    await requireActions(admin, record.profile_id, ['planning.sync']);
    const { data: profile, error: profileError } = await admin.from('profiles').select('id,tenant_owner_id').eq('id', record.profile_id).single();
    if (profileError || !profile) throw profileError || new Error('Calendar profile unavailable');
    const tenantOwnerId = profile.tenant_owner_id || profile.id;
    const tokens = await exchangeGoogleCode(code), access = await encryptToken(tokens.access_token!), refresh = tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null;
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { authorization: `Bearer ${tokens.access_token}` } });
    const userInfo = userInfoResponse.ok ? await userInfoResponse.json() as { email?: string } : {};
    const { error } = await admin.from("calendar_connections").upsert({ profile_id: record.profile_id, tenant_owner_id: tenantOwnerId, provider: "GOOGLE", calendar_email: userInfo.email || null, connected: true, sync_enabled: true, encrypted_access_token: access.value, encrypted_refresh_token: refresh?.value || null, access_token_iv: access.iv, access_token_tag: access.tag, refresh_token_iv: refresh?.iv || null, refresh_token_tag: refresh?.tag || null, token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(), scope: tokens.scope || null, calendar_id: "primary", updated_at: new Date().toISOString() });
    if (error) throw error;
    return redirectToApp("connected");
  } catch (error) {
    console.error(error);
    return redirectToApp("error");
  }
});
