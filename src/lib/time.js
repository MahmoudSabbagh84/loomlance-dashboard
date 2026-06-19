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
