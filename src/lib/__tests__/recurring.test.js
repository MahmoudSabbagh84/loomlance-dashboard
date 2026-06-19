import { describe, it, expect } from 'vitest'
import { CADENCES, cadenceLabel, validateTemplateLineItems } from '@/lib/recurring'

describe('CADENCES', () => {
  it('has the four cadences', () => {
    expect(CADENCES.map((c) => c.value)).toEqual(['weekly', 'monthly', 'quarterly', 'yearly'])
  })
})

describe('cadenceLabel', () => {
  it('maps a known value', () => expect(cadenceLabel('monthly')).toBe('Monthly'))
  it('falls back to the raw value', () => expect(cadenceLabel('nope')).toBe('nope'))
})

describe('validateTemplateLineItems', () => {
  it('accepts a valid list', () => {
    expect(() => validateTemplateLineItems([{ description: 'Retainer' }])).not.toThrow()
  })
  it('rejects an empty list', () => {
    expect(() => validateTemplateLineItems([])).toThrow(/at least one/i)
  })
  it('rejects a missing description', () => {
    expect(() => validateTemplateLineItems([{ description: '  ' }])).toThrow(/description/i)
  })
})
