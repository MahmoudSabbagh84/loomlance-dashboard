import { describe, it, expect } from 'vitest'
import { monthlyAmountCents, computeStripeMetrics } from './metrics.ts'

const item = (unit_amount: number, interval: string, quantity = 1, interval_count = 1, currency = 'usd') => ({
  quantity,
  price: { unit_amount, currency, recurring: { interval, interval_count } },
})
const sub = (status: string, items: unknown[], extra: Record<string, unknown> = {}) => ({
  status,
  items: { data: items },
  trial_end: null,
  ended_at: null,
  ...extra,
})

describe('monthlyAmountCents', () => {
  it('passes monthly prices through', () => {
    expect(monthlyAmountCents(item(900, 'month'))).toBe(900)
  })
  it('divides annual by 12 and multiplies quantity', () => {
    expect(monthlyAmountCents(item(12000, 'year', 2))).toBe(2000)
  })
  it('divides by interval_count (e.g. every 3 months)', () => {
    expect(monthlyAmountCents(item(3000, 'month', 1, 3))).toBe(1000)
  })
  it('returns 0 for one-time or malformed items', () => {
    expect(monthlyAmountCents({ price: { unit_amount: 500 } })).toBe(0)
    expect(monthlyAmountCents(undefined)).toBe(0)
  })
})

describe('computeStripeMetrics', () => {
  it('sums MRR over active + past_due only, in integer cents', () => {
    const subs = [
      sub('active', [item(900, 'month')]),
      sub('past_due', [item(12000, 'year')]),
      sub('trialing', [item(900, 'month')]),
      sub('canceled', [item(900, 'month')]),
    ]
    const m = computeStripeMetrics(subs)
    expect(m.mrr).toBe(1900)
    expect(m.activeSubs).toBe(2)
    expect(m.trialing).toBe(1)
    expect(m.currency).toBe('usd')
  })
  it('classifies trials: converted vs churned vs neither', () => {
    const subs = [
      sub('active', [item(900, 'month')], { trial_end: 100 }),                        // converted
      sub('canceled', [item(900, 'month')], { trial_end: 200, ended_at: 150 }),       // churned in trial
      sub('canceled', [item(900, 'month')], { trial_end: 200, ended_at: 999 }),       // converted then canceled → neither
      sub('trialing', [item(900, 'month')], { trial_end: 999 }),                      // still trialing
    ]
    const m = computeStripeMetrics(subs)
    expect(m.trialsConverted).toBe(1)
    expect(m.trialsChurned).toBe(1)
    expect(m.trialing).toBe(1)
  })
  it('handles empty input', () => {
    expect(computeStripeMetrics([])).toEqual({
      mrr: 0, currency: 'usd', activeSubs: 0, trialing: 0, trialsConverted: 0, trialsChurned: 0,
    })
  })
})
