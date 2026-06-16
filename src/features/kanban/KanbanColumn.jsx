import { TaskCard } from './TaskCard'
import { Badge } from '@/components/ui/Badge'

export function KanbanColumn({ column, tasks, onTaskClick }) {
  const overLimit = column.wip_limit != null && tasks.length > column.wip_limit
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-bg-elevated p-3">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-medium">{column.name}</h3>
        <Badge variant={overLimit ? 'danger' : 'default'}>
          {tasks.length}{column.wip_limit != null ? ` / ${column.wip_limit}` : ''}
        </Badge>
      </div>
      <div className="flex flex-col gap-2 min-h-[100px]">
        {tasks.map((t) => <TaskCard key={t.id} task={t} onClick={() => onTaskClick?.(t)} />)}
      </div>
    </div>
  )
}
