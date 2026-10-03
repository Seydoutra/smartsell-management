import { describe, expect, it } from 'vitest'
import { statusTone } from '../src/lib/statusTone'

describe('task Kanban status colors', () => {
  it('gives every task column a distinct semantic color', () => {
    const statuses = ['A_FAIRE', 'EN_COURS', 'EN_ATTENTE', 'EN_REVUE', 'BLOQUE', 'TERMINE']
    expect(new Set(statuses.map(statusTone)).size).toBe(statuses.length)
    expect(statusTone('BLOQUE')).toBe('danger')
    expect(statusTone('TERMINE')).toBe('success')
  })
})
