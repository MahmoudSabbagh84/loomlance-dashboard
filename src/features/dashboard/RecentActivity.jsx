import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { relativeTime } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'

async function fetchRecent() {
  const [payments, invoices, contracts, projects] = await Promise.all([
    supabase.from('invoice_payments').select('id, amount, currency, paid_at, invoice_id, invoices(invoice_number, clients(name))').order('paid_at', { ascending: false }).limit(5),
    supabase.from('invoices').select('id, invoice_number, status, updated_at, clients(name)').order('updated_at', { ascending: false }).limit(5),
    supabase.from('contracts').select('id, title, status, updated_at, clients(name)').order('updated_at', { ascending: false }).limit(5),
    supabase.from('projects').select('id, name, status, updated_at, clients(name)').order('updated_at', { ascending: false }).limit(5),
  ])
  for (const r of [payments, invoices, contracts, projects]) if (r.error) throw mapPostgresError(r.error)
  const events = []
  for (const p of payments.data) events.push({ at: p.paid_at, text: `Payment ${formatCurrency(Number(p.amount), p.currency)} on ${p.invoices?.invoice_number} · ${p.invoices?.clients?.name || ''}`, to: `/invoices/${p.invoice_id}` })
  for (const i of invoices.data) events.push({ at: i.updated_at, text: `Invoice ${i.invoice_number} · ${i.status} · ${i.clients?.name || ''}`, to: `/invoices/${i.id}` })
  for (const c of contracts.data) events.push({ at: c.updated_at, text: `Contract ${c.title} · ${c.status} · ${c.clients?.name || ''}`, to: `/contracts/${c.id}` })
  for (const p of projects.data) events.push({ at: p.updated_at, text: `Project ${p.name} · ${p.status} · ${p.clients?.name || ''}`, to: `/projects/${p.id}` })
  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10)
}

export function RecentActivity() {
  const { data: events, isLoading } = useQuery({ queryKey: ['dashboard', 'recent'], queryFn: fetchRecent, staleTime: 30_000 })
  if (isLoading) return <Skeleton className="h-64" />

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
      {events.length === 0 ? (
        <p className="text-sm text-fg-muted">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e, i) => (
            <li key={i}>
              <Link to={e.to} className="block rounded-md p-2 hover:bg-bg-muted">
                <p className="text-sm">{e.text}</p>
                <p className="text-xs text-fg-muted">{relativeTime(e.at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
