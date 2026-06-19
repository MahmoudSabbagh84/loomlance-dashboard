import { describe, it, expect } from 'vitest'
import {
  EXPENSE_CATEGORIES,
  RECEIPT_MAX_BYTES,
  validateReceiptFile,
  buildExpenseInvoiceLines,
  expenseTotals,
} from '@/lib/expenses'

describe('EXPENSE_CATEGORIES', () => {
  it('includes the core presets', () => {
    expect(EXPENSE_CATEGORIES).toContain('Software')
    expect(EXPENSE_CATEGORIES).toContain('Other')
  })
})

describe('validateReceiptFile', () => {
  it('accepts a small PDF', () => {
    expect(() => validateReceiptFile({ type: 'application/pdf', size: 1000 })).not.toThrow()
  })
  it('rejects a disallowed type', () => {
    expect(() => validateReceiptFile({ type: 'text/csv', size: 1000 })).toThrow(/PDF|PNG|JPG|WebP/i)
  })
  it('rejects an oversize file', () => {
    expect(() => validateReceiptFile({ type: 'image/png', size: RECEIPT_MAX_BYTES + 1 })).toThrow(/under/i)
  })
})

describe('buildExpenseInvoiceLines', () => {
  it('one line per expense, description falls back to category', () => {
    const lines = buildExpenseInvoiceLines([
      { id: '1', description: '  ', category: 'Travel', amount: 50 },
      { id: '2', description: 'AWS', category: 'Software', amount: 12.5 },
    ])
    expect(lines).toEqual([
      { id: '1', description: 'Travel', amount: 50 },
      { id: '2', description: 'AWS', amount: 12.5 },
    ])
  })
})

describe('expenseTotals', () => {
  it('sums overall and by category, sorted desc', () => {
    const t = expenseTotals([
      { category: 'Software', amount: 10 },
      { category: 'Travel', amount: 25 },
      { category: 'Software', amount: 5 },
    ])
    expect(t.total).toBe(40)
    expect(t.byCategory).toEqual([
      { category: 'Travel', total: 25 },
      { category: 'Software', total: 15 },
    ])
  })
})
