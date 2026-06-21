import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/currency'
import { readyToBillExpenses } from '@/lib/expenses'
import {
  useExpenses,
  useGenerateInvoiceFromExpensesForProject,
  useGenerateInvoiceFromExpensesForClient,
} from '@/hooks/useExpenses'

export function ExpensesReadyToBillPanel() {
  const navigate = useNavigate()
  const { data: expenses = [] } = useExpenses({ status: 'unbilled' })
  const genProject = useGenerateInvoiceFromExpensesForProject()
  const genClient = useGenerateInvoiceFromExpensesForClient()
  const rows = readyToBillExpenses(expenses)

  if (rows.length === 0) return null

  const pending = genProject.isPending || genClient.isPending

  const onGenerate = async (row) => {
    try {
      const id =
        row.kind === 'project'
          ? await genProject.mutateAsync({ projectId: row.id, currency: row.currency })
          : await genClient.mutateAsync({ clientId: row.id, currency: row.currency })
      toast.success('Invoice ready')
      navigate(`/invoices/${id}`)
    } catch (e) {
      toast.error(e.userMessage || 'Could not generate invoice')
    }
  }

  return (
    <Card padding="md">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="size-4 text-fg-muted" />
        <h2 className="text-sm font-semibold">Ready to bill</h2>
        <span className="text-xs text-fg-muted">unbilled expenses by project / client</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={`${r.kind}-${r.id}-${r.currency}`} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {r.name}
                {r.kind === 'client' ? <span className="ml-1 text-xs text-fg-subtle">(no project)</span> : null}
              </p>
              <p className="truncate text-xs text-fg-muted">{r.clientName}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm tabular-nums">{formatCurrency(r.amount, r.currency)}</p>
                <p className="text-xs tabular-nums text-fg-muted">{r.count} item{r.count === 1 ? '' : 's'}</p>
              </div>
              <Button size="sm" onClick={() => onGenerate(r)} loading={pending}>
                Generate invoice
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
