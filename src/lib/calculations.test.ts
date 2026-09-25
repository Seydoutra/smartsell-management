import { describe, expect, it } from 'vitest'
import { can, withinLimit } from './permissions'
import { hasBookingConflict, invoiceBalance, invoiceSubtotal, invoiceTotal } from './calculations'

describe('calculs critiques',()=>{
  it('calcule une facture et son solde',()=>{const lines=[{quantity:2,unitPrice:1000,taxRate:18}];expect(invoiceSubtotal(lines)).toBe(2000);expect(invoiceTotal(lines)).toBe(2360);expect(invoiceBalance(2360,[1000])).toBe(1360)})
  it('détecte un conflit de réservation',()=>expect(hasBookingConflict('2026-09-25','2026-09-27','2026-09-26','2026-09-28')).toBe(true))
  it('centralise les permissions et limites',()=>{expect(can('SUPER_ADMIN','users.manage')).toBe(true);expect(can('COLLABORATEUR','finance.write')).toBe(false);expect(withinLimit(9,10,1)).toBe(true);expect(withinLimit(10,10,1)).toBe(false)})
})
