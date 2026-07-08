import { describe, it, expect } from 'vitest'
import { deriveAmount, decisionState } from '@/lib/changeRequest'

describe('deriveAmount', () => {
  it('computes hours × rate rounded to 2dp when both are present', () => {
    expect(deriveAmount({ hours: 8, hourly_rate: 100 })).toBe(800)
    expect(deriveAmount({ hours: 1.5, hourly_rate: 133.33 })).toBe(200) // 199.995 → 200.00
  })
  it('falls back to the entered amount when hours/rate are incomplete', () => {
    expect(deriveAmount({ amount: 500 })).toBe(500)
    expect(deriveAmount({ amount: 500, hours: 8 })).toBe(500) // rate missing
    expect(deriveAmount({})).toBe(0)
  })
})

describe('decisionState', () => {
  it('classifies by status', () => {
    expect(decisionState('sent')).toBe('decidable')
    expect(decisionState('approved')).toBe('already')
    expect(decisionState('declined')).toBe('already')
    expect(decisionState('draft')).toBe('invalid')
  })
})
