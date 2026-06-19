import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

function nextDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export async function fetchPayments({ from, to }) {
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('amount, currency, paid_at, invoices(client_id, project_id, clients(name), projects(name))')
    .gte('paid_at', `${from}T00:00:00Z`)
    .lt('paid_at', `${nextDay(to)}T00:00:00Z`)
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function fetchExpensesInRange({ from, to }) {
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, currency, spent_on')
    .gte('spent_on', from)
    .lte('spent_on', to)
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function fetchOpenInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, currency, due_date, status, clients(name), invoice_line_items(quantity, unit_price, tax_rate, discount_rate)')
    .in('status', ['sent', 'viewed', 'overdue'])
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function fetchTimeEntriesInRange({ from, to }) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('duration_minutes, billable, hourly_rate, project_id, projects(name)')
    .not('ended_at', 'is', null)
    .gte('started_at', `${from}T00:00:00Z`)
    .lt('started_at', `${nextDay(to)}T00:00:00Z`)
  if (error) throw mapPostgresError(error)
  return data || []
}
