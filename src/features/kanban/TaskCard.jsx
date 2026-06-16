import { Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate, isOverdue } from '@/lib/date'
import { cn } from '@/components/ui/cn'

const PRIORITY_VARIANT = { low: 'default', medium: 'info', high: 'danger' }

export function TaskCard({ task, onClick }) {
  const overdue = isOverdue(task.due_date, 'sent')
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.() }}
      className="rounded-md border border-border bg-bg p-3 text-sm hover:border-border-strong cursor-pointer"
    >
      <p className="font-medium leading-snug">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
        {(task.labels || []).map((l) => (
          <span key={l.name} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: l.color + '33', color: l.color }}>
            {l.name}
          </span>
        ))}
        {task.due_date ? (
          <span className={cn('inline-flex items-center gap-1 text-xs', overdue ? 'text-danger' : 'text-fg-muted')}>
            <Calendar className="size-3" />
            {formatDate(task.due_date, 'MMM d')}
          </span>
        ) : null}
      </div>
    </div>
  )
}
