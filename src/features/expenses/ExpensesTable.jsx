import { Pencil, Trash2, Paperclip } from 'lucide-react'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'

export function ExpensesTable({ expenses, onEdit, onDelete, onOpenReceipt }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Date</TH>
          <TH>Category</TH>
          <TH>Description</TH>
          <TH>Project / Client</TH>
          <TH>Amount</TH>
          <TH>Status</TH>
          <TH></TH>
        </TR>
      </THead>
      <tbody>
        {expenses.map((e) => (
          <TR key={e.id}>
            <TD className="text-xs tabular-nums text-fg-muted">{formatDate(e.spent_on)}</TD>
            <TD>{e.category}</TD>
            <TD className="text-fg-muted">{e.description || '—'}</TD>
            <TD className="text-fg-muted">
              {e.projects?.name ? (
                <>
                  {e.projects.name}
                  {e.projects.clients?.name ? (
                    <span className="text-fg-subtle"> / {e.projects.clients.name}</span>
                  ) : null}
                </>
              ) : (
                e.clients?.name || '—'
              )}
            </TD>
            <TD className="tabular-nums">{formatCurrency(Number(e.amount), e.currency)}</TD>
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
                {e.receipt_path ? (
                  <button onClick={() => onOpenReceipt(e.receipt_path)} className="text-fg-subtle hover:text-fg" aria-label="View receipt">
                    <Paperclip className="size-4" />
                  </button>
                ) : null}
                <button onClick={() => onEdit(e)} className="text-fg-subtle hover:text-fg" aria-label="Edit">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => onDelete(e)} className="text-fg-subtle hover:text-danger" aria-label="Delete">
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
