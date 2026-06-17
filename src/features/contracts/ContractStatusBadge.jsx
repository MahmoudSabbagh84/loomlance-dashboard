import { Badge } from '@/components/ui/Badge'

const MAP = { draft: 'default', active: 'success', completed: 'info', expired: 'warning', canceled: 'danger' }

export function ContractStatusBadge({ status }) {
  return <Badge variant={MAP[status] || 'default'}>{status}</Badge>
}
