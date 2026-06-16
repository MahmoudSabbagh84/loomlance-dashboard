import { useMemo } from 'react'
import { useKanbanColumns } from '@/hooks/useKanbanColumns'
import { useTasks } from '@/hooks/useTasks'
import { KanbanColumn } from './KanbanColumn'

export function KanbanBoard({ projectId }) {
  const { data: columns = [] } = useKanbanColumns(projectId)
  const { data: tasks = [] } = useTasks(projectId)

  const tasksByColumn = useMemo(() => {
    const map = new Map()
    for (const c of columns) map.set(c.id, [])
    for (const t of tasks) {
      if (!map.has(t.column_id)) map.set(t.column_id, [])
      map.get(t.column_id).push(t)
    }
    for (const [, arr] of map) arr.sort((a, b) => a.position - b.position)
    return map
  }, [columns, tasks])

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3">
        {columns.map((col) => (
          <KanbanColumn key={col.id} column={col} tasks={tasksByColumn.get(col.id) || []} />
        ))}
      </div>
    </div>
  )
}
