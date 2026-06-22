import { FileText, FileSignature, Receipt } from 'lucide-react'
import { useInvoices } from '@/hooks/useInvoices'
import { useContracts } from '@/hooks/useContracts'
import { useExpenses } from '@/hooks/useExpenses'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'

export function ActivityTab({ clientId }) {
  const { data: invoicesPage } = useInvoices({ clientId, pageSize: 100 })
  const { data: contractsPage } = useContracts({ clientId, pageSize: 100 })
  const { data: expenses = [] } = useExpenses({ clientId })

  const events = []
  for (const i of invoicesPage?.rows ?? []) {
    events.push({ id: `inv-${i.id}`, date: i.issue_date || i.created_at, Icon: FileText, title: `Invoice ${i.invoice_number}`, meta: i.status })
  }
  for (const c of contractsPage?.rows ?? []) {
    events.push({ id: `con-${c.id}`, date: c.created_at, Icon: FileSignature, title: `Contract: ${c.title}`, meta: c.status })
  }
  for (const e of expenses) {
    events.push({
      id: `exp-${e.id}`,
      date: e.spent_on || e.created_at,
      Icon: Receipt,
      title: `Expense: ${(typeof e.description === 'string' && e.description.trim()) || e.category}`,
      meta: formatCurrency(Number(e.amount), e.currency),
    })
  }
  events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())

  if (events.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        No activity yet. Invoices, contracts, and expenses for this client will appear here.
      </p>
    )
  }

  return (
    <ol className="space-y-3">
      {events.map((ev) => (
        <li key={ev.id} className="flex items-start gap-3">
          <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-bg-muted text-fg-muted">
            <ev.Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{ev.title}</p>
            <p className="text-xs capitalize text-fg-muted">{ev.meta}</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-fg-muted">{ev.date ? formatDate(ev.date) : '—'}</span>
        </li>
      ))}
    </ol>
  )
}
