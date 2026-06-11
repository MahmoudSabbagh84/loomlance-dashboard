// src/lib/__tests__/money.test.js
import { describe, it, expect } from 'vitest'
import { lineTotal, invoiceTotals } from '@/lib/money'

describe('lineTotal', () => {
  it('quantity * unit_price with no tax or discount', () => {
    expect(lineTotal({ quantity: 2, unit_price: 50, tax_rate: 0, discount_rate: 0 })).toEqual({
      subtotal: 100,
      discount: 0,
      tax: 0,
      total: 100,
    })
  })
  it('applies discount before tax', () => {
    expect(
      lineTotal({ quantity: 1, unit_price: 100, tax_rate: 20, discount_rate: 10 })
    ).toEqual({ subtotal: 100, discount: 10, tax: 18, total: 108 })
  })
})

describe('invoiceTotals', () => {
  it('sums lines and groups tax by rate', () => {
    const r = invoiceTotals([
      { quantity: 1, unit_price: 100, tax_rate: 20, discount_rate: 0 },
      { quantity: 2, unit_price: 50, tax_rate: 20, discount_rate: 0 },
      { quantity: 1, unit_price: 50, tax_rate: 5, discount_rate: 0 },
    ])
    expect(r.subtotal).toBe(250)
    expect(r.discount).toBe(0)
    expect(r.taxByRate).toEqual({ 20: 40, 5: 2.5 })
    expect(r.totalTax).toBe(42.5)
    expect(r.total).toBe(292.5)
  })
})
