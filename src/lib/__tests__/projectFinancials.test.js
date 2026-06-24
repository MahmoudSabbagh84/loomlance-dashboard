import { describe, it, expect } from 'vitest'
import { projectFinancials } from '@/lib/projectFinancials'

const li = (total) => [{ quantity: 1, unit_price: total, tax_rate: 0, discount_rate: 0 }]

describe('projectFinancials', () => {
  it('counts issued invoices, separates drafts, excludes void', () => {
    const r = projectFinancials(
      {
        invoices: [
          { status: 'sent', currency: 'USD', invoice_line_items: li(100) },
          { status: 'viewed', currency: 'USD', invoice_line_items: li(50) },
          { status: 'paid', currency: 'USD', invoice_line_items: li(200) },
          { status: 'draft', currency: 'USD', invoice_line_items: li(40) },
          { status: 'void', currency: 'USD', invoice_line_items: li(999) },
        ],
      },
      'USD',
      null
    )
    expect(r.invoiced).toBe(350)
    expect(r.draftInvoiced).toBe(40)
  })

  it('sums paid from invoice_payments in the project currency', () => {
    const r = projectFinancials(
      {
        invoices: [
          {
            status: 'paid',
            currency: 'USD',
            invoice_line_items: li(200),
            invoice_payments: [
              { amount: 120, currency: 'USD' },
              { amount: 80, currency: 'USD' },
            ],
          },
        ],
      },
      'USD',
      null
    )
    expect(r.paid).toBe(200)
  })

  it('excludes different-currency invoices/expenses and counts them', () => {
    const r = projectFinancials(
      {
        invoices: [{ status: 'sent', currency: 'EUR', invoice_line_items: li(100) }],
        expenses: [{ amount: 50, currency: 'EUR', billable: true }],
      },
      'USD',
      null
    )
    expect(r.invoiced).toBe(0)
    expect(r.excludedCount).toBe(2)
  })

  it('unbilled-to-invoice = billable, uninvoiced expenses + time (hours x rate)', () => {
    const r = projectFinancials(
      {
        expenses: [
          { amount: 40, currency: 'USD', billable: true, invoiced_on_invoice_id: null },
          { amount: 10, currency: 'USD', billable: true, invoiced_on_invoice_id: 'inv1' },
          { amount: 5, currency: 'USD', billable: false, invoiced_on_invoice_id: null },
        ],
        timeEntries: [
          { billable: true, invoiced_on_invoice_id: null, duration_minutes: 120, hourly_rate: 50 },
          { billable: true, invoiced_on_invoice_id: 'inv1', duration_minutes: 60, hourly_rate: 50 },
          { billable: false, invoiced_on_invoice_id: null, duration_minutes: 60, hourly_rate: 50 },
        ],
      },
      'USD',
      null
    )
    expect(r.unbilledExpenses).toBe(40)
    expect(r.unbilledTime).toBe(100)
    expect(r.unbilledToInvoice).toBe(140)
  })

  it('remaining = budget - invoiced; profit = paid - expenses', () => {
    const r = projectFinancials(
      {
        invoices: [
          {
            status: 'sent',
            currency: 'USD',
            invoice_line_items: li(300),
            invoice_payments: [{ amount: 100, currency: 'USD' }],
          },
        ],
        expenses: [{ amount: 70, currency: 'USD', billable: false }],
      },
      'USD',
      1000
    )
    expect(r.remaining).toBe(700)
    expect(r.profit).toBe(30)
  })

  it('remaining is null when no budget set', () => {
    expect(projectFinancials({}, 'USD', null).remaining).toBeNull()
  })
})
