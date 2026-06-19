import { invoiceTotals } from '@/lib/money'
import { hoursFromMinutes } from '@/lib/time'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function iso(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export const DATE_PRESETS = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'last_12_months', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
]

export function rangeForPreset(preset, today) {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (preset) {
    case 'last_month':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
    case 'this_quarter': {
      const q = Math.floor(m / 3) * 3
      return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) }
    }
    case 'ytd':
      return { from: iso(new Date(y, 0, 1)), to: iso(today) }
    case 'last_12_months':
      return { from: iso(new Date(y, m - 11, 1)), to: iso(new Date(y, m + 1, 0)) }
    case 'this_month':
    default:
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) }
  }
}

export function monthBuckets(from, to) {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const out = []
  let y = fy
  let mo = fm
  while (y < ty || (y === ty && mo <= tm)) {
    out.push({ key: `${y}-${String(mo).padStart(2, '0')}`, label: `${MONTH_ABBR[mo - 1]} ${String(y).slice(2)}` })
    mo += 1
    if (mo > 12) {
      mo = 1
      y += 1
    }
  }
  return out
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const body = (rows || []).map((r) => columns.map((c) => csvCell(r[c.key])).join(',')).join('\n')
  return body ? `${header}\n${body}` : header
}

function daysBetween(fromStr, toStr) {
  const a = new Date(`${fromStr}T00:00:00Z`).getTime()
  const b = new Date(`${toStr}T00:00:00Z`).getTime()
  return Math.floor((b - a) / 86400000)
}

function toSortedArray(map) {
  return Object.entries(map)
    .map(([name, total]) => ({ name, total: round2(total) }))
    .sort((x, y) => y.total - x.total)
}

export function revenueReport(payments, range) {
  const months = monthBuckets(range.from, range.to)
  const acc = {}
  const ensure = (cur) => (acc[cur] ||= { monthTotals: {}, byClient: {}, byProject: {}, total: 0 })
  for (const p of payments || []) {
    const cur = p.currency || 'USD'
    const amt = Number(p.amount) || 0
    const b = ensure(cur)
    const key = (p.paid_at || '').slice(0, 7)
    b.monthTotals[key] = (b.monthTotals[key] || 0) + amt
    const client = p.invoices?.clients?.name || 'Unassigned'
    const project = p.invoices?.projects?.name || 'Unassigned'
    b.byClient[client] = (b.byClient[client] || 0) + amt
    b.byProject[project] = (b.byProject[project] || 0) + amt
    b.total += amt
  }
  const byCurrency = {}
  for (const [cur, b] of Object.entries(acc)) {
    byCurrency[cur] = {
      monthTotals: Object.fromEntries(Object.entries(b.monthTotals).map(([k, v]) => [k, round2(v)])),
      byClient: toSortedArray(b.byClient),
      byProject: toSortedArray(b.byProject),
      total: round2(b.total),
    }
  }
  return { currencies: Object.keys(byCurrency), months, byCurrency }
}

export function plReport(payments, expenses, range) {
  const months = monthBuckets(range.from, range.to)
  const acc = {}
  const ensure = (cur) => (acc[cur] ||= { rev: {}, exp: {} })
  for (const p of payments || []) {
    const b = ensure(p.currency || 'USD')
    const key = (p.paid_at || '').slice(0, 7)
    b.rev[key] = (b.rev[key] || 0) + (Number(p.amount) || 0)
  }
  for (const e of expenses || []) {
    const b = ensure(e.currency || 'USD')
    const key = (e.spent_on || '').slice(0, 7)
    b.exp[key] = (b.exp[key] || 0) + (Number(e.amount) || 0)
  }
  const byCurrency = {}
  for (const [cur, b] of Object.entries(acc)) {
    let tr = 0
    let te = 0
    const rows = months.map((m) => {
      const revenue = round2(b.rev[m.key] || 0)
      const expense = round2(b.exp[m.key] || 0)
      tr += revenue
      te += expense
      return { key: m.key, label: m.label, revenue, expense, net: round2(revenue - expense) }
    })
    byCurrency[cur] = { months: rows, totals: { revenue: round2(tr), expense: round2(te), net: round2(tr - te) } }
  }
  return { currencies: Object.keys(byCurrency), byCurrency }
}

export function agingReport(openInvoices, today) {
  const todayStr = iso(today)
  const acc = {}
  const ensure = (cur) => (acc[cur] ||= { buckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 }, rows: [], total: 0 })
  for (const inv of openInvoices || []) {
    const b = ensure(inv.currency || 'USD')
    const amount = round2(invoiceTotals(inv.invoice_line_items || []).total)
    const days = daysBetween(inv.due_date, todayStr)
    let bucket
    if (days <= 0) bucket = 'current'
    else if (days <= 30) bucket = 'd1_30'
    else if (days <= 60) bucket = 'd31_60'
    else if (days <= 90) bucket = 'd61_90'
    else bucket = 'd90plus'
    b.buckets[bucket] += amount
    b.total += amount
    b.rows.push({ invoice_number: inv.invoice_number, client: inv.clients?.name || 'Unassigned', due_date: inv.due_date, days_overdue: Math.max(0, days), amount, bucket })
  }
  const byCurrency = {}
  for (const [cur, b] of Object.entries(acc)) {
    byCurrency[cur] = {
      buckets: Object.fromEntries(Object.entries(b.buckets).map(([k, v]) => [k, round2(v)])),
      rows: b.rows.sort((x, y) => y.days_overdue - x.days_overdue),
      total: round2(b.total),
    }
  }
  return { currencies: Object.keys(byCurrency), byCurrency }
}

export function timeReport(entries) {
  const acc = {}
  const ensure = (name) => (acc[name] ||= { project: name, billableMin: 0, nonBillableMin: 0, amount: 0 })
  for (const e of entries || []) {
    const g = ensure(e.projects?.name || 'Unassigned')
    const mins = Number(e.duration_minutes) || 0
    if (e.billable) {
      g.billableMin += mins
      g.amount += (mins / 60) * (Number(e.hourly_rate) || 0)
    } else {
      g.nonBillableMin += mins
    }
  }
  let tb = 0
  let tn = 0
  let ta = 0
  const byProject = Object.values(acc)
    .map((g) => {
      const billableHours = hoursFromMinutes(g.billableMin)
      const nonBillableHours = hoursFromMinutes(g.nonBillableMin)
      tb += billableHours
      tn += nonBillableHours
      ta += g.amount
      return { project: g.project, billableHours, nonBillableHours, totalHours: round2(billableHours + nonBillableHours), amount: round2(g.amount) }
    })
    .sort((x, y) => y.totalHours - x.totalHours)
  return { byProject, totals: { billableHours: round2(tb), nonBillableHours: round2(tn), totalHours: round2(tb + tn), amount: round2(ta) } }
}
