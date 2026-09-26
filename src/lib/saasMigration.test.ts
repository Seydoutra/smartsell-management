import { describe, expect, it } from 'vitest'
import migration from '../../supabase/v18_saas_tenancy_foundation.sql?raw'

describe('SaaS tenancy foundation migration', () => {
  it.each([
    'organizations',
    'organization_memberships',
    'workspaces',
    'workspace_memberships',
    'user_tenant_contexts',
  ])('creates and protects %s with RLS', (table) => {
    expect(migration).toMatch(new RegExp(`create table if not exists public\\.${table}\\b`, 'i'))
    expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  })

  it('provides tenant-aware access helpers', () => {
    for (const helper of [
      'is_organization_member',
      'has_organization_role',
      'can_access_workspace',
      'current_organization_id',
      'current_workspace_id',
    ]) {
      expect(migration).toContain(`function public.${helper}`)
    }
  })

  it('does not add an allow-all authenticated policy', () => {
    expect(migration).not.toMatch(/to authenticated\s+using\s*\(true\)/i)
  })

  it('keeps privileged RPCs away from anonymous users', () => {
    expect(migration).toContain(
      'revoke all on function public.create_organization_with_workspace(text, text, text) from public;',
    )
    expect(migration).toContain(
      'grant execute on function public.create_organization_with_workspace(text, text, text) to authenticated;',
    )
    expect(migration).not.toMatch(/grant execute[^;]+\bto anon\b/i)
  })

  it('guards the last active organization owner', () => {
    expect(migration).toContain('function public.protect_last_organization_owner()')
    expect(migration).toContain('trigger protect_last_organization_owner')
  })
})
