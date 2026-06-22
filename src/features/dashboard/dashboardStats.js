import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function fetchDashboardStats() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  const today = now.toISOString().slice(0, 10)

  const [paid, outstanding, projects] = await Promise.all([
    supabase.from('invoice_payments').select('amount, currency').gte('paid_at', monthStart).lt('paid_at', monthEnd),
    supabase.from('invoices').select('id, currency, status, due_date, invoice_line_items(quantity,unit_price,tax_rate,discount_rate)').in('status', ['sent', 'viewed', 'overdue']),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active').is('archived_at', null),
  ])
  if (paid.error) throw mapPostgresError(paid.error)
  if (outstanding.error) throw mapPostgresError(outstanding.error)
  if (projects.error) throw mapPostgresError(projects.error)

  const groupByCurrency = (rows, valueFn) => {
    const acc = {}
    for (const r of rows || []) {
      const c = r.currency || 'USD'
      acc[c] = (acc[c] || 0) + valueFn(r)
    }
    return acc
  }

  return {
    revenueByCurrency: groupByCurrency(paid.data, (r) => Number(r.amount)),
    outstandingByCurrency: groupByCurrency(outstanding.data, (inv) => {
      // approximate from line items
      const items = inv.invoice_line_items || []
      return items.reduce((s, li) => {
        const gross = Number(li.quantity) * Number(li.unit_price)
        const net = gross * (1 - Number(li.discount_rate) / 100)
        const tax = net * (Number(li.tax_rate) / 100)
        return s + net + tax
      }, 0)
    }),
    // Truly overdue: explicitly 'overdue', or a sent/viewed invoice past its due date.
    overdueCount: (outstanding.data || []).filter(
      (inv) => inv.status === 'overdue' || (inv.due_date && inv.due_date < today)
    ).length,
    activeProjectCount: projects.count ?? 0,
  }
}
