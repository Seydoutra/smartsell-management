export function notificationProfileEligible(profile: { active?: boolean; is_beta_tester?: boolean; role?: string; roles?: string[]; access_expires_at?: string | null } | null, now = Date.now()) {
  if (!profile?.active || profile.is_beta_tester || profile.role === 'CLIENT' || profile.roles?.includes('CLIENT')) return false;
  if (!profile.access_expires_at) return true;
  const expires = Date.parse(profile.access_expires_at);
  return Number.isFinite(expires) && expires > now;
}

export async function automatedRecipientEligible(admin: any, profileId: string, tenantId: string) {
  if (!profileId || !tenantId) return false;
  const { data, error } = await admin.from('profiles').select('id,tenant_owner_id,active,is_beta_tester,role,roles,access_expires_at').in('id', [...new Set([profileId, tenantId])]);
  if (error) throw new Error('Vérification du destinataire indisponible');
  const recipient = data?.find((row: any) => row.id === profileId);
  const owner = data?.find((row: any) => row.id === tenantId);
  return recipient?.tenant_owner_id === tenantId && notificationProfileEligible(recipient) && notificationProfileEligible(owner);
}
