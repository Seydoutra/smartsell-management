import { describe, expect, it } from 'vitest'
import migration from '../../supabase/v19_self_service_trial.sql?raw'

describe('inscription autonome SmartSell', () => {
  it('limite les nouveaux comptes à 72 heures', () => {
    expect(migration).toMatch(/now\(\) \+ interval '72 hours'/i)
    expect(migration).toMatch(/is_temporary[\s\S]*true/i)
  })

  it('crée un message de bienvenue dans l’application', () => {
    expect(migration).toContain('Bienvenue sur SmartSell')
    expect(migration).toMatch(/insert into public\.notifications/i)
  })

  it('n’accorde pas de rôle administrateur aux inscriptions publiques', () => {
    expect(migration).toMatch(/array\['COLLABORATEUR'\]/i)
    expect(migration).not.toMatch(/array\['SUPER_ADMIN'\]/i)
  })
})
