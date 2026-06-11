import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns'

export function formatDate(d, fmt = 'MMM d, yyyy') {
  if (!d) return ''
  return format(typeof d === 'string' ? parseISO(d) : d, fmt)
}

export function relativeTime(d) {
  if (!d) return ''
  return formatDistanceToNow(typeof d === 'string' ? parseISO(d) : d, { addSuffix: true })
}

export function isOverdue(dueDate, status) {
  if (!dueDate || status === 'paid' || status === 'void' || status === 'draft') return false
  return isPast(typeof dueDate === 'string' ? parseISO(dueDate) : dueDate)
}

export function daysUntil(d) {
  if (!d) return null
  const target = typeof d === 'string' ? parseISO(d) : d
  const ms = target.getTime() - Date.now()
  return Math.ceil(ms / 86400000)
}
