// src/lib/changeRequest.js — pure helpers for scope-creep change requests.
const round2 = (n) => Math.round(n * 100) / 100

// The billable amount: hours × rate (rounded) when both are present, else the entered amount.
export function deriveAmount({ amount, hours, hourly_rate } = {}) {
  const h = Number(hours)
  const r = Number(hourly_rate)
  if (hours != null && hourly_rate != null && !Number.isNaN(h) && !Number.isNaN(r)) {
    return round2(h * r)
  }
  return Number(amount) || 0
}

// Whether a request in this status can be decided by the client.
export function decisionState(status) {
  if (status === 'sent') return 'decidable'
  if (status === 'approved' || status === 'declined') return 'already'
  return 'invalid'
}
