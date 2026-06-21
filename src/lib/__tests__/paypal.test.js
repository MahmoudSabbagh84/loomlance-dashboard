import { describe, it, expect } from 'vitest'
import { paypalHref } from '../paypal'

describe('paypalHref', () => {
  it('returns null for empty input', () => {
    expect(paypalHref('', 10, 'USD')).toBeNull()
    expect(paypalHref(null, 10, 'USD')).toBeNull()
    expect(paypalHref('   ', 10, 'USD')).toBeNull()
  })

  it('builds a paypal.me link from a bare username + appends amount', () => {
    expect(paypalHref('mahmoud', 25, 'USD')).toBe('https://paypal.me/mahmoud/25.00USD')
  })

  it('strips a leading @ from a username', () => {
    expect(paypalHref('@mahmoud', 25, 'EUR')).toBe('https://paypal.me/mahmoud/25.00EUR')
  })

  it('adds protocol to a paypal.me path and appends amount', () => {
    expect(paypalHref('paypal.me/mahmoud', 99.9, 'USD')).toBe('https://paypal.me/mahmoud/99.90USD')
  })

  it('keeps a full paypal.me URL and appends amount', () => {
    expect(paypalHref('https://paypal.me/mahmoud', 10, 'GBP')).toBe('https://paypal.me/mahmoud/10.00GBP')
  })

  it('does not double-append when the link already has an amount segment', () => {
    expect(paypalHref('https://paypal.me/mahmoud/50USD', 10, 'USD')).toBe('https://paypal.me/mahmoud/50USD')
  })

  it('passes through a non-paypal.me URL unchanged (just ensures protocol)', () => {
    expect(paypalHref('https://paypal.com/paypalme/mahmoud', 10, 'USD')).toBe('https://paypal.com/paypalme/mahmoud')
  })

  it('does not append an amount when amount is 0', () => {
    expect(paypalHref('paypal.me/mahmoud', 0, 'USD')).toBe('https://paypal.me/mahmoud')
  })
})
