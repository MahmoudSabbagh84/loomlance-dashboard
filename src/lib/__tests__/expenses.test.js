import { describe, it, expect } from 'vitest'
import {
  EXPENSE_CATEGORIES,
  RECEIPT_MAX_BYTES,
  validateReceiptFile,
  buildExpenseInvoiceLines,
  expenseTotals,
  readyToBillExpenses,
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
  it('rounds float sums to 2 decimals', () => {
    const t = expenseTotals([
      { category: 'X', amount: 0.1 },
      { category: 'X', amount: 0.2 },
    ])
    expect(t.total).toBe(0.3)
    expect(t.byCategory[0].total).toBe(0.3)
  })
})

describe('readyToBillExpenses', () => {
  const proj = (over) => ({
    billable: true, invoiced_on_invoice_id: null, currency: 'USD', amount: 50,
    project_id: 'p1', client_id: null,
    projects: { name: 'Web', clients: { name: 'Acme' } }, clients: null,
    ...over,
  })
  const cli = (over) => ({
    billable: true, invoiced_on_invoice_id: null, currency: 'USD', amount: 20,
    project_id: null, client_id: 'c9', projects: null, clients: { name: 'Globex' },
    ...over,
  })

  it('groups project expenses by project+currency', () => {
    const r = readyToBillExpenses([proj({ amount: 50 }), proj({ amount: 25 })])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'project', id: 'p1', name: 'Web', clientName: 'Acme', currency: 'USD', count: 2, amount: 75 })
  })
  it('groups project-less expenses by client+currency as client rows', () => {
    const r = readyToBillExpenses([cli({ amount: 20 }), cli({ amount: 5 })])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'client', id: 'c9', name: 'Globex', currency: 'USD', count: 2, amount: 25 })
  })
  it('splits by currency and excludes non-billable / billed', () => {
    const r = readyToBillExpenses([
      proj({ currency: 'USD', amount: 10 }),
      proj({ currency: 'EUR', amount: 30 }),
      proj({ billable: false }),
      proj({ invoiced_on_invoice_id: 'inv1' }),
    ])
    expect(r).toHaveLength(2)
    expect(r.map((x) => x.currency).sort()).toEqual(['EUR', 'USD'])
  })
  it('empty -> []', () => {
    expect(readyToBillExpenses([])).toEqual([])
  })
})
