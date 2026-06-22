import { Pencil, Trash2 } from 'lucide-react'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/date'
import { formatDuration } from '@/lib/time'
import { formatCurrency } from '@/lib/currency'

export function TimeEntriesTable({ entries, currency = 'USD', onEdit, onDelete }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Date</TH>
          <TH>Project</TH>
          <TH>Client</TH>
          <TH>Contract</TH>
          <TH>Description</TH>
          <TH>Duration</TH>
          <TH>Rate</TH>
          <TH>Status</TH>
          <TH></TH>
        </TR>
      </THead>
      <tbody>
        {entries.map((e) => (
          <TR key={e.id}>
            <TD className="text-xs tabular-nums text-fg-muted">{formatDate(e.started_at)}</TD>
            <TD>{e.projects?.name}</TD>
            <TD className="text-fg-muted">{e.projects?.clients?.name || '—'}</TD>
            <TD className="text-fg-muted">{e.contracts?.title || '—'}</TD>
            <TD className="text-fg-muted">{e.description || '—'}</TD>
            <TD className="tabular-nums">
              {e.ended_at ? formatDuration(e.duration_minutes) : <span className="text-primary">running…</span>}
            </TD>
            <TD className="tabular-nums">{e.hourly_rate != null ? formatCurrency(Number(e.hourly_rate), currency) : '—'}</TD>
            <TD>
              {!e.billable ? (
                <Badge>non-billable</Badge>
              ) : e.invoiced_on_invoice_id ? (
                <Badge variant="success">billed</Badge>
              ) : (
                <Badge variant="info">unbilled</Badge>
              )}
            </TD>
            <TD>
              <div className="flex justify-end gap-1">
                <button onClick={() => onEdit(e)} className="text-fg-muted hover:text-fg" aria-label="Edit">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => onDelete(e)} className="text-fg-muted hover:text-danger" aria-label="Delete">
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
