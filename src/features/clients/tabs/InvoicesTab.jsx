import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { InvoiceStatusBadge } from '@/features/invoices/InvoiceStatusBadge'
import { formatDate } from '@/lib/date'

export function InvoicesTab({ clientId }) {
  const { data } = useInvoices({ clientId, pageSize: 100 })
  if (!data?.rows.length) return <p className="text-sm text-fg-muted">No invoices for this client.</p>
  return (
    <Table>
      <THead><TR><TH>Number</TH><TH>Issue</TH><TH>Due</TH><TH>Status</TH></TR></THead>
      <tbody>
        {data.rows.map((inv) => (
          <TR key={inv.id}>
            <TD><Link to={`/invoices/${inv.id}`} className="font-medium tabular-nums hover:text-primary">{inv.invoice_number}</Link></TD>
            <TD className="text-xs tabular-nums text-fg-muted">{formatDate(inv.issue_date)}</TD>
            <TD className="text-xs tabular-nums text-fg-muted">{formatDate(inv.due_date)}</TD>
            <TD><InvoiceStatusBadge status={inv.status} /></TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}
