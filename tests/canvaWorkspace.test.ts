import { describe, expect, it } from 'vitest'
import { resolveCanvaWorkspace } from '../supabase/functions/_shared/canvaWorkspace'

const ownerId = 'owner-tenant-a'

describe('Canva workspace access', () => {
  it('resolves a collaborator to the owner connection only within that tenant', () => {
    expect(resolveCanvaWorkspace('collaborator-a', { tenant_owner_id: ownerId, role: 'COMMUNITY_MANAGER', roles: ['COMMUNITY_MANAGER'] }, { allowed_modules: ['Éditorial'], denied_permissions: [] })).toEqual({ tenantOwnerId: ownerId, isOwner: false, canView: true })
    expect(resolveCanvaWorkspace('collaborator-b', { tenant_owner_id: 'owner-tenant-b', role: 'COMMUNITY_MANAGER', roles: ['COMMUNITY_MANAGER'] }, { allowed_modules: ['Éditorial'], denied_permissions: [] }).tenantOwnerId).toBe('owner-tenant-b')
  })

  it('keeps connection management with the tenant owner', () => {
    expect(resolveCanvaWorkspace(ownerId, { tenant_owner_id: ownerId, role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] }, null)).toEqual({ tenantOwnerId: ownerId, isOwner: true, canView: true })
    expect(resolveCanvaWorkspace('admin-a', { tenant_owner_id: ownerId, role: 'ADMIN', roles: ['ADMIN'] }, { allowed_modules: ['Éditorial'], denied_permissions: [] }).isOwner).toBe(false)
  })

  it('does not expose designs to clients or collaborators without editorial permission', () => {
    expect(resolveCanvaWorkspace('client-a', { tenant_owner_id: ownerId, role: 'CLIENT', roles: ['CLIENT'] }, { allowed_modules: ['Éditorial'], denied_permissions: [] }).canView).toBe(false)
    expect(resolveCanvaWorkspace('user-a', { tenant_owner_id: ownerId, role: 'COLLABORATEUR', roles: ['COLLABORATEUR'] }, { allowed_modules: ['Éditorial'], denied_permissions: ['editorial.view'] }).canView).toBe(false)
    expect(resolveCanvaWorkspace('user-b', { tenant_owner_id: ownerId, role: 'COLLABORATEUR', roles: ['COLLABORATEUR'] }, { allowed_modules: ['Planning'], denied_permissions: [] }).canView).toBe(false)
  })
})
