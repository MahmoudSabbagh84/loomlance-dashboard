import { describe, it, expect } from 'vitest'
import { computeDurationMinutes, hoursFromMinutes, formatDuration, formatElapsed, groupTimeForInvoice, readyToBillByProject, activeSeconds } from '@/lib/time'

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

describe('activeSeconds', () => {
  const start = '2026-01-01T09:00:00Z'
  const startMs = new Date(start).getTime()

  it('running: now - start - prior pauses', () => {
    const now = startMs + 3600_000 // +1h
    expect(activeSeconds({ started_at: start, paused_seconds: 600 }, now)).toBe(3000) // 3600 - 600
  })
  it('paused: frozen at paused_at, ignores now', () => {
    const paused_at = '2026-01-01T09:30:00Z' // +30m
    const r = activeSeconds({ started_at: start, paused_at, paused_seconds: 0 }, startMs + 9999_000)
    expect(r).toBe(1800)
  })
  it('finalized: ended_at - start - pauses', () => {
    const ended_at = '2026-01-01T10:00:00Z' // +1h
    expect(activeSeconds({ started_at: start, ended_at, paused_seconds: 300 }, startMs + 99999)).toBe(3300)
  })
  it('never negative; no started_at -> 0', () => {
    expect(activeSeconds({ started_at: start, paused_seconds: 99999 }, startMs + 1000)).toBe(0)
    expect(activeSeconds({}, startMs)).toBe(0)
  })
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
