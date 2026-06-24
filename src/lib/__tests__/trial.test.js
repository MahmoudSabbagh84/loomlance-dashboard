import { describe, it, expect } from 'vitest'
import { shouldStartTrial } from '@/lib/trial'

const free = { subscription_tier: 'free', stripe_customer_id: null, stripe_subscription_id: null }

describe('shouldStartTrial', () => {
  it('redirects a paid-intent free user with no stripe customer yet', () => {
    expect(shouldStartTrial(free, 'freelancer')).toBe('redirect')
    expect(shouldStartTrial(free, 'studio')).toBe('redirect')
  })

  it('shows the banner once a customer exists but no subscription (bailed)', () => {
    expect(shouldStartTrial({ ...free, stripe_customer_id: 'cus_1' }, 'freelancer')).toBe('banner')
  })

  it('does nothing for a Solo / no-intent signup', () => {
    expect(shouldStartTrial(free, 'solo')).toBe('none')
    expect(shouldStartTrial(free, undefined)).toBe('none')
  })

  it('does nothing once subscribed (tier set or subscription id present)', () => {
    expect(
      shouldStartTrial(
        { subscription_tier: 'tier_1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' },
        'freelancer'
      )
    ).toBe('none')
    expect(shouldStartTrial({ ...free, stripe_subscription_id: 'sub_1' }, 'freelancer')).toBe('none')
  })

  it('does nothing without a profile', () => {
    expect(shouldStartTrial(null, 'freelancer')).toBe('none')
  })
})
