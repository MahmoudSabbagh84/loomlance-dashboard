import { format, subMonths, startOfMonth } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export function lastNMonths(n) {
  const now = startOfMonth(new Date())
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = subMonths(now, i)
    out.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM') })
  }
  return out
}

export async function fetchInsights() {
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('amount, currency, paid_at, invoices(client_id, clients(name))')
    .order('paid_at', { ascending: true })
  if (error) throw mapPostgresError(error)

  const byCurrency = {}
  for (const p of data || []) {
    const cur = p.currency || 'USD'
    const amt = Number(p.amount) || 0
    const bucket = (byCurrency[cur] ||= { monthTotals: {}, clientTotals: {}, total: 0 })
    bucket.total += amt
    const monthKey = (p.paid_at || '').slice(0, 7)
    if (monthKey) bucket.monthTotals[monthKey] = (bucket.monthTotals[monthKey] || 0) + amt
    const name = p.invoices?.clients?.name || 'Unknown client'
    bucket.clientTotals[name] = (bucket.clientTotals[name] || 0) + amt
  }

  const currencies = Object.keys(byCurrency).sort((a, b) => byCurrency[b].total - byCurrency[a].total)
  return { months: lastNMonths(6), byCurrency, currencies }
}
