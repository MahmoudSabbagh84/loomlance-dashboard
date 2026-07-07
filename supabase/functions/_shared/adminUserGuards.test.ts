// supabase/functions/_shared/adminUserGuards.test.ts
import { describe, it, expect } from 'vitest'
import { compGuard, banGuard, VALID_TIERS, DEMO_USER_ID } from './adminUserGuards.ts'

const ME = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002'

describe('compGuard', () => {
  it('404s a missing user', () => {
    expect(compGuard(null, 'tier_1')).toEqual({ ok: false, status: 404, message: 'User not found' })
  })
  it('400s an invalid tier', () => {
    const r = compGuard({ id: OTHER, stripe_subscription_id: null }, 'gold')
    expect(r).toEqual({ ok: false, status: 400, message: 'Invalid tier' })
  })
  it('409s a user with a live Stripe subscription', () => {
    const r = compGuard({ id: OTHER, stripe_subscription_id: 'sub_123', subscription_status: 'active' }, 'tier_2')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(409)
      expect(r.message).toMatch(/Stripe/)
    }
  })
  it('passes a churned ex-subscriber (canceled sub emits no further webhooks)', () => {
    const r = compGuard({ id: OTHER, stripe_subscription_id: 'sub_123', subscription_status: 'canceled' }, 'tier_1')
    expect(r).toEqual({ ok: true })
  })
  it('passes a non-subscriber with a valid tier', () => {
    for (const tier of VALID_TIERS) {
      expect(compGuard({ id: OTHER, stripe_subscription_id: null }, tier)).toEqual({ ok: true })
    }
  })
})

describe('banGuard', () => {
  it('404s a missing user', () => {
    expect(banGuard(ME, null)).toEqual({ ok: false, status: 404, message: 'User not found' })
  })
  it('409s banning yourself', () => {
    const r = banGuard(ME, { id: ME, is_admin: true })
    expect(r).toEqual({ ok: false, status: 409, message: 'You cannot ban your own account' })
  })
  it('409s banning the demo user', () => {
    const r = banGuard(ME, { id: DEMO_USER_ID, is_admin: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/demo/i)
  })
  it('409s banning another admin', () => {
    const r = banGuard(ME, { id: OTHER, is_admin: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/admin/i)
  })
  it('passes a normal target', () => {
    expect(banGuard(ME, { id: OTHER, is_admin: false })).toEqual({ ok: true })
  })
})
