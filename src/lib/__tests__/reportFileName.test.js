import { describe, it, expect } from 'vitest'
import { reportFileName } from '@/lib/reports'

describe('reportFileName', () => {
  it('names the data type, currency, and selected date range', () => {
    expect(reportFileName('revenue', 'USD', { from: '2026-01-01', to: '2026-03-31' })).toBe(
      'revenue-USD (2026-01-01 to 2026-03-31).csv'
    )
  })

  it('uses an "as of" date for point-in-time reports (aging)', () => {
    expect(reportFileName('aging', 'USD', { asOf: '2026-06-23' })).toBe('aging-USD (as of 2026-06-23).csv')
  })

  it('degrades gracefully with no period or currency', () => {
    expect(reportFileName('time', '', {})).toBe('time.csv')
    expect(reportFileName('time', 'EUR')).toBe('time-EUR.csv')
  })
})
