import { Link } from 'react-router-dom'
import { useContracts } from '@/hooks/useContracts'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { ContractStatusBadge } from '@/features/contracts/ContractStatusBadge'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'

export function ContractsTab({ clientId }) {
  const { data } = useContracts({ clientId, pageSize: 100 })
  if (!data?.rows.length) return <p className="text-sm text-fg-muted">No contracts for this client.</p>
  return (
    <Table>
      <THead><TR><TH>Title</TH><TH>Value</TH><TH>Dates</TH><TH>Status</TH></TR></THead>
      <tbody>
        {data.rows.map((c) => (
          <TR key={c.id}>
            <TD><Link to={`/contracts/${c.id}`} className="font-medium hover:text-primary">{c.title}</Link></TD>
            <TD className="tabular-nums">{c.value != null ? formatCurrency(c.value, c.currency) : '—'}</TD>
            <TD className="text-xs tabular-nums text-fg-muted">{c.start_date ? formatDate(c.start_date) : '—'} → {c.end_date ? formatDate(c.end_date) : '—'}</TD>
            <TD><ContractStatusBadge status={c.status} /></TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}
