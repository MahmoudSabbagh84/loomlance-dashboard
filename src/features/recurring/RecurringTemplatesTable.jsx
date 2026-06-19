import { Play, Pause, FilePlus, Pencil, Trash2 } from 'lucide-react'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { invoiceTotals } from '@/lib/money'
import { cadenceLabel } from '@/lib/recurring'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'

function statusBadge(t) {
  const ended = t.end_date && t.end_date <= new Date().toISOString().slice(0, 10)
  if (!t.active) return ended ? <Badge>ended</Badge> : <Badge variant="warning">paused</Badge>
  return <Badge variant="success">active</Badge>
}

export function RecurringTemplatesTable({ templates, onGenerate, onToggleActive, onEdit, onDelete }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Template</TH>
          <TH>Cadence</TH>
          <TH>Next run</TH>
          <TH>Status</TH>
          <TH>Est. amount</TH>
          <TH></TH>
        </TR>
      </THead>
      <tbody>
        {templates.map((t) => (
          <TR key={t.id}>
            <TD>
              <div className="font-medium">{t.title || 'Untitled'}</div>
              <div className="text-xs text-fg-muted">{t.clients?.name || '—'}</div>
            </TD>
            <TD>{cadenceLabel(t.cadence)}</TD>
            <TD className="text-xs tabular-nums text-fg-muted">{formatDate(t.next_run_at)}</TD>
            <TD>{statusBadge(t)}</TD>
            <TD className="tabular-nums">{formatCurrency(invoiceTotals(t.line_items || []).total, t.currency)}</TD>
            <TD>
              <div className="flex justify-end gap-1">
                <button onClick={() => onGenerate(t)} className="text-fg-subtle hover:text-fg" aria-label="Generate now">
                  <FilePlus className="size-4" />
                </button>
                <button onClick={() => onToggleActive(t)} className="text-fg-subtle hover:text-fg" aria-label={t.active ? 'Pause' : 'Resume'}>
                  {t.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button onClick={() => onEdit(t)} className="text-fg-subtle hover:text-fg" aria-label="Edit">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => onDelete(t)} className="text-fg-subtle hover:text-danger" aria-label="Delete">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}
