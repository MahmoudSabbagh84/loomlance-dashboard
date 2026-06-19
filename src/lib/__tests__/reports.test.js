import { describe, it, expect } from 'vitest'
import {
  DATE_PRESETS,
  rangeForPreset,
  monthBuckets,
  toCSV,
  revenueReport,
  plReport,
  agingReport,
  timeReport,
} from '@/lib/reports'

const TODAY = new Date(2026, 5, 19) // 2026-06-19 (local)

describe('DATE_PRESETS', () => {
  it('includes the six presets', () => {
    expect(DATE_PRESETS.map((p) => p.value)).toEqual(['this_month', 'last_month', 'this_quarter', 'ytd', 'last_12_months', 'custom'])
  })
})

describe('rangeForPreset', () => {
  it('this_month', () => expect(rangeForPreset('this_month', TODAY)).toEqual({ from: '2026-06-01', to: '2026-06-30' }))
  it('last_month', () => expect(rangeForPreset('last_month', TODAY)).toEqual({ from: '2026-05-01', to: '2026-05-31' }))
  it('this_quarter (Q2)', () => expect(rangeForPreset('this_quarter', TODAY)).toEqual({ from: '2026-04-01', to: '2026-06-30' }))
  it('ytd', () => expect(rangeForPreset('ytd', TODAY)).toEqual({ from: '2026-01-01', to: '2026-06-19' }))
  it('last_12_months', () => expect(rangeForPreset('last_12_months', TODAY)).toEqual({ from: '2025-07-01', to: '2026-06-30' }))
})

describe('monthBuckets', () => {
  it('spans inclusive months with labels', () => {
    expect(monthBuckets('2026-05-10', '2026-07-02')).toEqual([
      { key: '2026-05', label: 'May 26' },
      { key: '2026-06', label: 'Jun 26' },
      { key: '2026-07', label: 'Jul 26' },
    ])
  })
})

describe('toCSV', () => {
  it('builds header + rows and escapes specials', () => {
    const cols = [{ key: 'name', label: 'Name' }, { key: 'total', label: 'Total' }]
    const rows = [{ name: 'Acme, Inc', total: 100 }, { name: 'He said "hi"', total: 5 }]
    expect(toCSV(rows, cols)).toBe('Name,Total\n"Acme, Inc",100\n"He said ""hi""",5')
  })
  it('returns just the header when no rows', () => {
    expect(toCSV([], [{ key: 'a', label: 'A' }])).toBe('A')
  })
})

const RANGE = { from: '2026-05-01', to: '2026-06-30' }

describe('revenueReport', () => {
  it('groups payments by month/client/project per currency', () => {
    const payments = [
      { amount: 100, currency: 'USD', paid_at: '2026-05-10T12:00:00Z', invoices: { clients: { name: 'Acme' }, projects: { name: 'Site' } } },
      { amount: 50, currency: 'USD', paid_at: '2026-06-02T09:00:00Z', invoices: { clients: { name: 'Acme' }, projects: null } },
      { amount: 40, currency: 'EUR', paid_at: '2026-06-03T09:00:00Z', invoices: { clients: { name: 'Globex' }, projects: { name: 'App' } } },
    ]
    const r = revenueReport(payments, RANGE)
    expect(r.currencies.sort()).toEqual(['EUR', 'USD'])
    expect(r.byCurrency.USD.total).toBe(150)
    expect(r.byCurrency.USD.monthTotals['2026-05']).toBe(100)
    expect(r.byCurrency.USD.monthTotals['2026-06']).toBe(50)
    expect(r.byCurrency.USD.byClient).toEqual([{ name: 'Acme', total: 150 }])
    expect(r.byCurrency.USD.byProject.find((p) => p.name === 'Unassigned').total).toBe(50)
  })
})

describe('plReport', () => {
  it('computes net = revenue - expense per month', () => {
    const payments = [{ amount: 200, currency: 'USD', paid_at: '2026-06-01T00:00:00Z' }]
    const expenses = [{ amount: 75, currency: 'USD', spent_on: '2026-06-15' }]
    const r = plReport(payments, expenses, RANGE)
    const jun = r.byCurrency.USD.months.find((m) => m.key === '2026-06')
    expect(jun).toMatchObject({ revenue: 200, expense: 75, net: 125 })
    expect(r.byCurrency.USD.totals).toEqual({ revenue: 200, expense: 75, net: 125 })
  })
})

describe('agingReport', () => {
  const today = new Date(2026, 5, 30) // 2026-06-30
  const li = (amt) => [{ quantity: 1, unit_price: amt, tax_rate: 0, discount_rate: 0 }]
  it('buckets invoices by days past due', () => {
    const invoices = [
      { invoice_number: 'A', currency: 'USD', due_date: '2026-07-05', clients: { name: 'X' }, invoice_line_items: li(10) }, // future -> current
      { invoice_number: 'B', currency: 'USD', due_date: '2026-06-30', clients: { name: 'X' }, invoice_line_items: li(20) }, // due today -> current
      { invoice_number: 'C', currency: 'USD', due_date: '2026-06-15', clients: { name: 'X' }, invoice_line_items: li(30) }, // 15 -> d1_30
      { invoice_number: 'D', currency: 'USD', due_date: '2026-03-01', clients: { name: 'X' }, invoice_line_items: li(40) }, // >90 -> d90plus
    ]
    const r = agingReport(invoices, today)
    expect(r.byCurrency.USD.buckets.current).toBe(30)
    expect(r.byCurrency.USD.buckets.d1_30).toBe(30)
    expect(r.byCurrency.USD.buckets.d90plus).toBe(40)
    expect(r.byCurrency.USD.total).toBe(100)
  })
})

describe('timeReport', () => {
  it('splits billable vs non-billable and computes amount', () => {
    const entries = [
      { duration_minutes: 90, billable: true, hourly_rate: 100, projects: { name: 'Site' } },
      { duration_minutes: 30, billable: false, hourly_rate: 0, projects: { name: 'Site' } },
      { duration_minutes: 60, billable: true, hourly_rate: 50, projects: { name: 'App' } },
    ]
    const r = timeReport(entries)
    const site = r.byProject.find((p) => p.project === 'Site')
    expect(site).toMatchObject({ billableHours: 1.5, nonBillableHours: 0.5, totalHours: 2, amount: 150 })
    expect(r.totals.amount).toBe(200)
    expect(r.totals.billableHours).toBe(2.5)
  })
})
