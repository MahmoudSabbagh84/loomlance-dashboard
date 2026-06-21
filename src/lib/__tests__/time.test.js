import { describe, it, expect } from 'vitest'
import { computeDurationMinutes, hoursFromMinutes, formatDuration, formatElapsed, groupTimeForInvoice, readyToBillByProject } from '@/lib/time'

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

describe('readyToBillByProject', () => {
  const base = (over) => ({
    project_id: 'a',
    billable: true,
    ended_at: '2026-01-01T10:00:00Z',
    invoiced_on_invoice_id: null,
    duration_minutes: 60,
    hourly_rate: 100,
    projects: { name: 'Web', client_id: 'c1', clients: { name: 'Acme' } },
    ...over,
  })

  it('groups by project, summing hours and amount across rates', () => {
    const rows = [
      base({ duration_minutes: 90, hourly_rate: 100 }),
      base({ duration_minutes: 30, hourly_rate: 100 }),
      base({ duration_minutes: 60, hourly_rate: 140 }),
    ]
    const r = readyToBillByProject(rows)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ projectId: 'a', projectName: 'Web', clientName: 'Acme', hours: 3, amount: 340 })
  })

  it('excludes non-billable, running, and already-billed entries', () => {
    const rows = [
      base({ billable: false }),
      base({ ended_at: null }),
      base({ invoiced_on_invoice_id: 'inv1' }),
      base({ duration_minutes: 120, hourly_rate: 50 }),
    ]
    const r = readyToBillByProject(rows)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ hours: 2, amount: 100 })
  })

  it('returns one row per project, sorted by project name', () => {
    const rows = [
      base({ project_id: 'b', projects: { name: 'Zebra', client_id: 'c2', clients: { name: 'Z Co' } } }),
      base({ project_id: 'a', projects: { name: 'Alpha', client_id: 'c1', clients: { name: 'A Co' } } }),
    ]
    const r = readyToBillByProject(rows)
    expect(r.map((x) => x.projectName)).toEqual(['Alpha', 'Zebra'])
  })

  it('empty input -> []', () => {
    expect(readyToBillByProject([])).toEqual([])
    expect(readyToBillByProject(undefined)).toEqual([])
  })
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
