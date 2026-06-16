import { useDroppable } from '@dnd-kit/core'
import { TaskCard } from './TaskCard'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/components/ui/cn'

export function KanbanColumn({ column, tasks, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const overLimit = column.wip_limit != null && tasks.length > column.wip_limit

  return (
    <div className={cn('flex w-72 shrink-0 flex-col rounded-lg bg-bg-elevated p-3 snap-start', isOver && 'ring-2 ring-primary')}>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-medium">{column.name}</h3>
        <Badge variant={overLimit ? 'danger' : 'default'}>
          {tasks.length}{column.wip_limit != null ? ` / ${column.wip_limit}` : ''}
        </Badge>
      </div>
      <div ref={setNodeRef} className="flex flex-col gap-2 min-h-[100px]">
        {tasks.map((t) => <TaskCard key={t.id} task={t} onClick={() => onTaskClick?.(t)} />)}
      </div>
    </div>
  )
}
