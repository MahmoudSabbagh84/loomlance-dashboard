import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/currency'
import { readyToBillByProject } from '@/lib/time'
import { useTimeEntries, useGenerateInvoiceFromTimeForProject } from '@/hooks/useTimeEntries'

export function ReadyToBillPanel({ currency = 'USD' }) {
  const navigate = useNavigate()
  const { data: entries = [] } = useTimeEntries({ status: 'unbilled' })
  const gen = useGenerateInvoiceFromTimeForProject()
  const rows = readyToBillByProject(entries)

  if (rows.length === 0) return null

  const onGenerate = async (projectId) => {
    try {
      const id = await gen.mutateAsync(projectId)
      toast.success('Draft invoice created')
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
        <span className="text-xs text-fg-muted">unbilled time by project</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.projectId} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.projectName}</p>
              <p className="truncate text-xs text-fg-muted">{r.clientName}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm tabular-nums">{formatCurrency(r.amount, currency)}</p>
                <p className="text-xs tabular-nums text-fg-muted">{r.hours}h</p>
              </div>
              <Button
                size="sm"
                onClick={() => onGenerate(r.projectId)}
                loading={gen.isPending && gen.variables === r.projectId}
              >
                Generate invoice
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
