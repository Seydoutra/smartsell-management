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

export async function claimReminder(admin: any, table: string, id: string) {
  if (!['task_assignment_sms', 'project_assignment_sms', 'task_reminder_schedule'].includes(table)) throw new Error('File de rappel invalide');
  const {data,error} = await admin.from(table).update({status:'PROCESSING'}).eq('id',id).eq('status','PENDING').select('id').maybeSingle();
  if (error) throw new Error('Réservation du rappel impossible');
  return !!data;
}
