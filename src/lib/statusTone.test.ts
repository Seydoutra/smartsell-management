import { describe, expect, it } from 'vitest'
import { statusTone } from './statusTone'

describe('statusTone', () => {
  it.each([
    ['IMPAYEE','danger'], ['NON_PAYEE','danger'], ['En retard','danger'],
    ['PARTIELLEMENT_PAYEE','warning'], ['PAYEE','success'], ['Encaissé','success'],
    ['EN_COURS','progress'], ['EN_ATTENTE','pending'], ['BROUILLON','neutral'],
    ['PLANIFIE','info'], ['SUSPENDU','danger'], ['APPROUVE','success'],
  ])('%s → %s', (status, tone) => expect(statusTone(status)).toBe(tone))
})
