// src/lib/__tests__/currency.test.js
import { describe, it, expect } from 'vitest'
import { formatCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency'

describe('SUPPORTED_CURRENCIES', () => {
  it('includes major currencies', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code)
    expect(codes).toEqual(expect.arrayContaining(['USD', 'EUR', 'GBP', 'CAD', 'AUD']))
  })
})

describe('formatCurrency', () => {
  it('formats USD with $', () => {
    expect(formatCurrency(1234.5, 'USD', 'en-US')).toMatch(/\$1,234\.50/)
  })
  it('formats EUR with €', () => {
    expect(formatCurrency(1234.5, 'EUR', 'en-GB')).toMatch(/€1,234\.50/)
  })
})
