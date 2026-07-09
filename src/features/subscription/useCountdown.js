import { useEffect, useMemo, useState } from 'react'
import { parseISO } from 'date-fns'

const EXPIRED = { days: 0, hours: 0, minutes: 0, total: 0, expired: true }

function breakdown(ms) {
  if (ms <= 0) return EXPIRED
  const totalMinutes = Math.floor(ms / 60000)
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    total: ms,
    expired: false,
  }
}

// Live days/hours/minutes remaining until `endsAt` (ISO string or Date). Ticks every 30s —
// enough to keep the minute honest without re-rendering every second. Returns `expired` once
// the target has passed so callers can swap to a "finalizing" state.
export function useCountdown(endsAt) {
  const targetMs = useMemo(() => {
    if (!endsAt) return null
    const d = typeof endsAt === 'string' ? parseISO(endsAt) : endsAt
    const t = d.getTime()
    return Number.isNaN(t) ? null : t
  }, [endsAt])

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (targetMs == null) return undefined
    // Re-sync immediately on mount/focus-return, then tick.
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [targetMs])

  if (targetMs == null) return EXPIRED
  return breakdown(targetMs - now)
}
