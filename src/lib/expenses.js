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
