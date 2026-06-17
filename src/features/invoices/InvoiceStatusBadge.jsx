import { Badge } from '@/components/ui/Badge'

const MAP = { draft: 'default', sent: 'info', viewed: 'info', paid: 'success', overdue: 'danger', void: 'default' }

export function InvoiceStatusBadge({ status }) {
  return <Badge variant={MAP[status] || 'default'}>{status}</Badge>
}
