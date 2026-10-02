import { describe, expect, it } from 'vitest'
import { validateBillingItems } from './billingValidation'

describe('validation de facture et devis', () => {
  const line = { description: 'Prestation', quantity: 1, unit_price: 100, tax_rate: 0 }
  it('accepte une ligne valide', () => expect(validateBillingItems([line], 0)).toBeNull())
  it('refuse une description vide', () => expect(validateBillingItems([{ ...line, description: ' ' }], 0)).toMatch(/description/))
  it('refuse une quantité nulle', () => expect(validateBillingItems([{ ...line, quantity: 0 }], 0)).toMatch(/quantité/))
  it('refuse une remise supérieure au total', () => expect(validateBillingItems([line], 101)).toMatch(/remise/))
})
