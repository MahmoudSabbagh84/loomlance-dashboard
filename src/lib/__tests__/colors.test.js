import { describe, it, expect } from 'vitest'
import { INVOICE_DEFAULT_ACCENT } from '@/lib/colors'

describe('INVOICE_DEFAULT_ACCENT', () => {
  it('is a valid 6-digit hex color', () => {
    expect(INVOICE_DEFAULT_ACCENT).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('is not the retired #2D3E50 slate', () => {
    // Regression for LOO-55: unbranded invoices must not default to the old brand color.
    expect(INVOICE_DEFAULT_ACCENT.toUpperCase()).not.toBe('#2D3E50')
  })
})
