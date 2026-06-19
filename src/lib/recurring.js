import { AppError } from '@/lib/errors'

export const CADENCES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

export function cadenceLabel(value) {
  return CADENCES.find((c) => c.value === value)?.label ?? value
}

export function validateTemplateLineItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('UNKNOWN', 'Add at least one line item.')
  }
  for (const it of items) {
    if (!it || typeof it.description !== 'string' || !it.description.trim()) {
      throw new AppError('UNKNOWN', 'Every line item needs a description.')
    }
  }
}
