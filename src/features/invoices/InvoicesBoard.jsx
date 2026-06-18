import { cn } from '@/components/ui/cn'
import { formatDate } from '@/lib/date'

const COLUMNS = [
  { key: 'draft', label: 'Draft', dot: 'bg-fg-subtle' },
  { key: 'sent', label: 'Sent', dot: 'bg-info' },
  { key: 'viewed', label: 'Viewed', dot: 'bg-info' },
  { key: 'overdue', label: 'Overdue', dot: 'bg-danger' },
  { key: 'paid', label: 'Paid', dot: 'bg-success' },
  { key: 'void', label: 'Void', dot: 'bg-fg-subtle' },
]

export function InvoicesBoard({ invoices, onOpen }) {
  const byStatus = Object.fromEntries(COLUMNS.map((c) => [c.key, []]))
  for (const inv of invoices) {
    if (byStatus[inv.status]) byStatus[inv.status].push(inv)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const items = byStatus[col.key]
        return (
          <div key={col.key} className="flex w-64 shrink-0 flex-col">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className={cn('size-2 rounded-full', col.dot)} />
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="tabular-nums text-xs text-fg-muted">{items.length}</span>
            </div>
            <div className="min-h-16 space-y-2 rounded-lg bg-bg-muted/40 p-2">
              {items.length === 0 ? (
                <p className="py-4 text-center text-xs text-fg-subtle">—</p>
              ) : (
                items.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => onOpen(inv.id)}
                    className="block w-full rounded-md border border-border bg-bg-elevated p-3 text-left transition-colors hover:border-border-strong"
                  >
                    <p className="text-sm font-medium tabular-nums">{inv.invoice_number}</p>
                    <p className="truncate text-xs text-fg-muted">{inv.clients?.name || '—'}</p>
                    <p className="mt-1 tabular-nums text-xs text-fg-subtle">Due {formatDate(inv.due_date)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
