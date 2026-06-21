import { AppError } from '@/lib/errors'

export const EXPENSE_CATEGORIES = [
  'Software',
  'Hardware',
  'Travel',
  'Meals',
  'Subscriptions',
  'Office',
  'Contractors',
  'Fees',
  'Other',
]

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
export const RECEIPT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

export function validateReceiptFile(file) {
  if (!file || !RECEIPT_TYPES.includes(file.type)) {
    throw new AppError('UNKNOWN', 'Receipt must be a PDF, PNG, JPG, or WebP file.')
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    throw new AppError('UNKNOWN', 'Receipt must be under 5 MB.')
  }
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

// Group billable, unbilled expenses for the Ready-to-bill panel: one row per
// (project, currency) and per (client, currency) for project-less expenses.
export function readyToBillExpenses(expenses) {
  const map = new Map()
  for (const e of expenses || []) {
    if (!e.billable || e.invoiced_on_invoice_id) continue
    const currency = e.currency || 'USD'
    const hasProject = !!e.project_id
    const kind = hasProject ? 'project' : 'client'
    const id = hasProject ? e.project_id : e.client_id
    if (!id) continue
    const key = `${kind}|${id}|${currency}`
    const row = map.get(key) || {
      kind,
      id,
      currency,
      name: hasProject ? e.projects?.name || 'Project' : e.clients?.name || 'Client',
      clientName: hasProject ? e.projects?.clients?.name || '—' : e.clients?.name || '—',
      count: 0,
      amount: 0,
    }
    row.count += 1
    row.amount += Number(e.amount) || 0
    map.set(key, row)
  }
  return [...map.values()]
    .map((r) => ({ ...r, amount: round2(r.amount) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function buildExpenseInvoiceLines(expenses) {
  return (expenses || []).map((e) => ({
    id: e.id,
    description: (typeof e.description === 'string' && e.description.trim()) || e.category,
    amount: round2(e.amount),
  }))
}

export function expenseTotals(expenses) {
  const map = new Map()
  let total = 0
  for (const e of expenses || []) {
    const amt = Number(e.amount) || 0
    total += amt
    map.set(e.category, (map.get(e.category) || 0) + amt)
  }
  const byCategory = [...map.entries()]
    .map(([category, t]) => ({ category, total: round2(t) }))
    .sort((a, b) => b.total - a.total)
  return { total: round2(total), byCategory }
}
