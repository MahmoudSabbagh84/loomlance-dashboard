import { useDroppable } from '@dnd-kit/core'
import { TaskCard } from './TaskCard'
import { InlineAddTask } from './InlineAddTask'
import { ColumnSettingsMenu } from './ColumnSettingsMenu'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/components/ui/cn'

export function KanbanColumn({ column, tasks, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const overLimit = column.wip_limit != null && tasks.length > column.wip_limit

  return (
    <div
      className={cn(
        'flex w-72 shrink-0 flex-col self-start rounded-lg bg-bg-elevated p-3 snap-start ring-1 ring-transparent transition-shadow',
        isOver && 'ring-2 ring-primary',
        overLimit && !isOver && 'ring-1 ring-danger/40'
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-medium">{column.name}</h3>
          <Badge variant={overLimit ? 'danger' : 'default'}>
            {tasks.length}{column.wip_limit != null ? ` / ${column.wip_limit}` : ''}
          </Badge>
        </div>
        <ColumnSettingsMenu projectId={column.project_id} column={column} tasksInColumn={tasks.length} />
      </div>
      <div ref={setNodeRef} className="flex min-h-[100px] flex-col gap-2">
        {tasks.map((t) => <TaskCard key={t.id} task={t} onClick={() => onTaskClick?.(t)} />)}
      </div>
      <InlineAddTask projectId={column.project_id} columnId={column.id} lastPosition={tasks[tasks.length - 1]?.position} />
    </div>
  )
}
