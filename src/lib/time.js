export function computeDurationMinutes(startedAt, endedAt) {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  return Math.max(0, Math.round(ms / 60000))
}

export function hoursFromMinutes(minutes) {
  return Math.round(((minutes || 0) / 60) * 100) / 100
}

export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes || 0))
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h && mm) return `${h}h ${mm}m`
  if (h) return `${h}h`
  return `${mm}m`
}

export function formatElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// Aggregate billable, completed, unbilled entries into one row per project for
// the "Ready to bill" panel. amount is an estimate (sum of hours x rate).
export function readyToBillByProject(entries) {
  const groups = new Map()
  for (const e of entries || []) {
    if (!e.billable || !e.ended_at || e.invoiced_on_invoice_id) continue
    const g = groups.get(e.project_id) || {
      projectId: e.project_id,
      projectName: e.projects?.name || 'Project',
      clientId: e.projects?.client_id ?? null,
      clientName: e.projects?.clients?.name || '—',
      minutes: 0,
      amount: 0,
    }
    const mins = Number(e.duration_minutes) || 0
    g.minutes += mins
    g.amount += (mins / 60) * (Number(e.hourly_rate) || 0)
    groups.set(e.project_id, g)
  }
  return [...groups.values()]
    .map((g) => ({
      projectId: g.projectId,
      projectName: g.projectName,
      clientId: g.clientId,
      clientName: g.clientName,
      hours: hoursFromMinutes(g.minutes),
      amount: Math.round(g.amount * 100) / 100,
    }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName))
}

// Active (unpaused) elapsed seconds for a time entry. The active window ends at
// ended_at (finalized), else paused_at (paused, frozen), else nowMs (running).
// paused_seconds is the accumulated time from earlier pauses.
export function activeSeconds(entry, nowMs) {
  if (!entry?.started_at) return 0
  const start = new Date(entry.started_at).getTime()
  const end = entry.ended_at
    ? new Date(entry.ended_at).getTime()
    : entry.paused_at
      ? new Date(entry.paused_at).getTime()
      : nowMs
  const secs = (end - start) / 1000 - (Number(entry.paused_seconds) || 0)
  return Math.max(0, Math.round(secs))
}

export function groupTimeForInvoice(entries) {
  const groups = new Map()
  for (const e of entries || []) {
    const rate = Number(e.hourly_rate) || 0
    const key = `${e.project_id}|${rate}`
    const g = groups.get(key) || { projectId: e.project_id, projectName: e.projects?.name || 'Project', rate, minutes: 0 }
    g.minutes += Number(e.duration_minutes) || 0
    groups.set(key, g)
  }
  return [...groups.values()].map((g) => {
    const hours = hoursFromMinutes(g.minutes)
    return { ...g, hours, amount: Math.round(hours * g.rate * 100) / 100 }
  })
}
