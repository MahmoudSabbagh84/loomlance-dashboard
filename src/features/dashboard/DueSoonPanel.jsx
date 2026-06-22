import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, FileCheck, CheckSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { formatDate, daysUntil } from '@/lib/date'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'

async function fetchDueSoon() {
  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  const [inv, con, tk] = await Promise.all([
    supabase.from('invoices').select('id, invoice_number, due_date, clients(name)').in('status', ['sent', 'viewed']).gte('due_date', today).lte('due_date', in7).order('due_date'),
    supabase.from('contracts').select('id, title, end_date, clients(name)').not('end_date', 'is', null).gte('end_date', today).lte('end_date', in30).order('end_date'),
    supabase.from('tasks').select('id, title, due_date, project_id').is('archived_at', null).not('due_date', 'is', null).gte('due_date', today).lte('due_date', in3).order('due_date'),
  ])
  if (inv.error) throw mapPostgresError(inv.error)
  if (con.error) throw mapPostgresError(con.error)
  if (tk.error) throw mapPostgresError(tk.error)
  return {
    invoices: inv.data || [],
    contracts: con.data || [],
    tasks: tk.data || [],
  }
}

export function DueSoonPanel() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'due-soon'], queryFn: fetchDueSoon, staleTime: 60_000 })
  if (isLoading) return <Skeleton className="h-64" />

  const items = [
    ...data.invoices.map((i) => ({ key: 'inv-' + i.id, icon: FileText, title: `${i.invoice_number} · ${i.clients?.name || ''}`, sub: `Due ${formatDate(i.due_date)}`, to: `/invoices/${i.id}`, days: daysUntil(i.due_date) })),
    ...data.contracts.map((c) => ({ key: 'con-' + c.id, icon: FileCheck, title: c.title, sub: `Ends ${formatDate(c.end_date)} · ${c.clients?.name || ''}`, to: `/contracts/${c.id}`, days: daysUntil(c.end_date) })),
    ...data.tasks.map((t) => ({ key: 'tsk-' + t.id, icon: CheckSquare, title: t.title, sub: `Due ${formatDate(t.due_date)}`, to: `/projects/${t.project_id}`, days: daysUntil(t.due_date) })),
  ].sort((a, b) => a.days - b.days).slice(0, 5)

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold">Due soon</h3>
      {items.length === 0 ? (
        <p className="text-sm text-fg-muted">All clear — nothing due in the next 7 days.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => {
            const Icon = i.icon
            return (
              <li key={i.key}>
                <Link to={i.to} className="flex items-start gap-3 rounded-md p-2 hover:bg-bg-muted">
                  <Icon className="mt-0.5 size-4 text-fg-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{i.title}</p>
                    <p className="text-xs text-fg-muted">{i.sub}</p>
                  </div>
                  <span className="text-xs tabular-nums text-fg-muted">{i.days}d</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
