import { describe, it, expect } from 'vitest'
import { paymentMethods } from '@/lib/payments'

describe('paymentMethods', () => {
  it('returns ["card"] when only Stripe is connected (can_pay true, no paypal)', () => {
    expect(paymentMethods({ can_pay: true, paypal_link: null })).toEqual(['card'])
  })

  it('returns ["paypal"] when only a PayPal link is set', () => {
    expect(paymentMethods({ can_pay: false, paypal_link: 'paypal.me/jane' })).toEqual(['paypal'])
  })

  it('returns ["card","paypal"] in that order when both are available', () => {
    expect(paymentMethods({ can_pay: true, paypal_link: 'paypal.me/jane' })).toEqual(['card', 'paypal'])
  })

  it('returns [] when neither is available', () => {
    expect(paymentMethods({ can_pay: false, paypal_link: null })).toEqual([])
  })

  it('ignores a blank/whitespace paypal_link', () => {
    expect(paymentMethods({ can_pay: false, paypal_link: '   ' })).toEqual([])
  })

  it('returns [] for missing/undefined issuer (no throw)', () => {
    expect(paymentMethods(undefined)).toEqual([])
    expect(paymentMethods(null)).toEqual([])
    expect(paymentMethods({})).toEqual([])
  })
})
