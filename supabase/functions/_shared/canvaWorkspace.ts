export type CanvaWorkspaceProfile = {
  tenant_owner_id: string | null
  role: string
  roles: string[] | null
}

export type CanvaWorkspacePermissions = {
  allowed_modules: string[] | null
  denied_permissions: string[] | null
  canva_access: boolean | null
} | null

export function resolveCanvaWorkspace(profileId: string, profile: CanvaWorkspaceProfile, permissions: CanvaWorkspacePermissions) {
  const tenantOwnerId = profile.tenant_owner_id || profileId
  const isOwner = tenantOwnerId === profileId
  const roles = profile.roles || []
  const isClient = profile.role === 'CLIENT' || roles.includes('CLIENT')
  const canView = !isClient && (isOwner || Boolean(
    permissions?.canva_access &&
    permissions?.allowed_modules?.includes('Éditorial') &&
    !permissions?.denied_permissions?.includes('editorial.view')
  ))
  return { tenantOwnerId, isOwner, canView }
}
