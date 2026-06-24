import { PencilLine, Send, Eye, CheckCircle2, AlertTriangle, Ban } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

const MAP = {
  draft: { variant: 'default', label: 'Draft', Icon: PencilLine },
  sent: { variant: 'info', label: 'Sent', Icon: Send },
  viewed: { variant: 'info', label: 'Viewed', Icon: Eye },
  paid: { variant: 'success', label: 'Paid', Icon: CheckCircle2 },
  overdue: { variant: 'danger', label: 'Overdue', Icon: AlertTriangle },
  void: { variant: 'default', label: 'Void', Icon: Ban },
}

// size="sm" (default) for lists/board; size="lg" leads with a per-status icon for
// the invoice header, where the status needs to read at a glance.
export function InvoiceStatusBadge({ status, size = 'sm', className }) {
  const s = MAP[status] || { variant: 'default', label: status, Icon: null }
  const Icon = s.Icon
  return (
    <Badge variant={s.variant} size={size} className={className}>
      {size === 'lg' && Icon ? <Icon className="size-4" aria-hidden /> : null}
      {s.label}
    </Badge>
  )
}
