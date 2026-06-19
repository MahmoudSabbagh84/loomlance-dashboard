import { describe, it, expect } from 'vitest'
import { computeDurationMinutes, hoursFromMinutes, formatDuration, formatElapsed, groupTimeForInvoice } from '@/lib/time'

describe('computeDurationMinutes', () => {
  it('rounds ms to minutes', () => {
    expect(computeDurationMinutes('2026-01-01T09:00:00Z', '2026-01-01T10:30:00Z')).toBe(90)
  })
  it('never negative', () => {
    expect(computeDurationMinutes('2026-01-01T10:00:00Z', '2026-01-01T09:00:00Z')).toBe(0)
  })
})

describe('hoursFromMinutes', () => {
  it('2 decimals', () => expect(hoursFromMinutes(90)).toBe(1.5))
})

describe('formatDuration', () => {
  it('h+m', () => expect(formatDuration(90)).toBe('1h 30m'))
  it('h only', () => expect(formatDuration(120)).toBe('2h'))
  it('m only', () => expect(formatDuration(45)).toBe('45m'))
})

describe('formatElapsed', () => {
  it('H:MM:SS', () => expect(formatElapsed(3661)).toBe('1:01:01'))
})

describe('groupTimeForInvoice', () => {
  it('groups by project + rate and sums', () => {
    const rows = [
      { project_id: 'a', hourly_rate: 100, duration_minutes: 90, projects: { name: 'Web' } },
      { project_id: 'a', hourly_rate: 100, duration_minutes: 30, projects: { name: 'Web' } },
      { project_id: 'a', hourly_rate: 140, duration_minutes: 60, projects: { name: 'Web' } },
    ]
    const g = groupTimeForInvoice(rows)
    expect(g).toHaveLength(2)
    const at100 = g.find((x) => x.rate === 100)
    expect(at100.hours).toBe(2)
    expect(at100.amount).toBe(200)
  })
})
