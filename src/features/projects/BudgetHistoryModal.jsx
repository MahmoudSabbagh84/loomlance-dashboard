import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { useBudgetHistory } from '@/hooks/useProjectFinancials'

export function BudgetHistoryModal({ open, onClose, projectId }) {
  const { data: rows = [], isLoading } = useBudgetHistory(projectId)

  return (
    <Modal open={open} onClose={onClose} title="Budget history" size="sm">
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">No budget changes yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium tabular-nums">
                  {r.previous_amount == null ? '—' : formatCurrency(r.previous_amount, r.currency)}
                  <span className="px-1.5 text-fg-subtle">→</span>
                  {r.new_amount == null ? '—' : formatCurrency(r.new_amount, r.currency)}
                </span>
                <span className="shrink-0 text-xs text-fg-muted">{formatDate(r.created_at)}</span>
              </div>
              {r.note ? <p className="mt-1 text-sm text-fg-muted">{r.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
