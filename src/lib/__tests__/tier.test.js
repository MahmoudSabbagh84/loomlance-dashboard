// src/lib/__tests__/tier.test.js
import { describe, it, expect } from 'vitest'
import { TIER_LIMITS, canCreateProject, hasFeature, FEATURES } from '@/lib/tier'

describe('TIER_LIMITS', () => {
  it('free allows 1 active project', () => {
    expect(TIER_LIMITS.free.maxActiveProjects).toBe(1)
  })
  it('tier_1 allows 5', () => {
    expect(TIER_LIMITS.tier_1.maxActiveProjects).toBe(5)
  })
  it('tier_2 is unlimited (Infinity)', () => {
    expect(TIER_LIMITS.tier_2.maxActiveProjects).toBe(Infinity)
  })
})

describe('canCreateProject', () => {
  it('free with 0 active → true', () => {
    expect(canCreateProject('free', 0)).toBe(true)
  })
  it('free with 1 active → false', () => {
    expect(canCreateProject('free', 1)).toBe(false)
  })
  it('tier_1 with 5 active → false', () => {
    expect(canCreateProject('tier_1', 5)).toBe(false)
  })
  it('tier_2 with 999 active → true', () => {
    expect(canCreateProject('tier_2', 999)).toBe(true)
  })
})

describe('hasFeature', () => {
  it('free cannot use recurring_invoices', () => {
    expect(hasFeature('free', FEATURES.RECURRING_INVOICES)).toBe(false)
  })
  it('tier_1 can use recurring_invoices', () => {
    expect(hasFeature('tier_1', FEATURES.RECURRING_INVOICES)).toBe(true)
  })
  it('tier_2 can use expenses', () => {
    expect(hasFeature('tier_2', FEATURES.EXPENSES)).toBe(true)
  })
  it('tier_1 cannot use expenses', () => {
    expect(hasFeature('tier_1', FEATURES.EXPENSES)).toBe(false)
  })

  it.each([FEATURES.GITHUB, FEATURES.CHANGE_REQUESTS, FEATURES.VAULT])(
    'differentiator %s is gated to Freelancer+ (free=false, tier_1=true, tier_2=true)',
    (feature) => {
      expect(hasFeature('free', feature)).toBe(false)
      expect(hasFeature('tier_1', feature)).toBe(true)
      expect(hasFeature('tier_2', feature)).toBe(true)
    }
  )
})
