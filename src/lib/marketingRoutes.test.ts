import { describe, expect, it } from 'vitest'
import { marketingRouteFromPath } from './marketingRoutes'

describe('public marketing routes', () => {
  const base='/smartsell-management/'
  it('opens every standalone page directly', () => {
    for(const route of ['solutions','fonctionnement','personnalisation','tarifs','contact','parrainage']){
      expect(marketingRouteFromPath(`${base}${route}/`,base)).toBe(route)
    }
  })
  it('does not confuse the app or another base path with a marketing page', () => {
    expect(marketingRouteFromPath(`${base}`,base)).toBeNull()
    expect(marketingRouteFromPath('/other/solutions/',base)).toBeNull()
    expect(marketingRouteFromPath(`${base}solutions-inconnues/`,base)).toBeNull()
  })
})
