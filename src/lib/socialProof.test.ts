import { describe, expect, it } from 'vitest'
import { publicClientReferences, publicTestimonials } from './socialProof'

describe('public social proof', () => {
  it('clearly labels every simulated reference', () => {
    expect(publicClientReferences.length).toBeGreaterThan(0)
    expect(publicTestimonials.length).toBeGreaterThan(0)
    expect(publicClientReferences.every(reference => reference.demo === true)).toBe(true)
    expect(publicTestimonials.every(testimonial => testimonial.demo === true)).toBe(true)
  })
})
