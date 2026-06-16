import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useKanbanColumns } from '@/hooks/useKanbanColumns'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { positionBetween } from '@/api/tasks'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'

export function KanbanBoard({ projectId, onTaskClick }) {
  const { data: columns = [] } = useKanbanColumns(projectId)
  const { data: tasks = [] } = useTasks(projectId)
  const updateTask = useUpdateTask(projectId)
  const [activeTask, setActiveTask] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const tasksByColumn = useMemo(() => {
    const map = new Map()
    for (const c of columns) map.set(c.id, [])
    for (const t of tasks) {
      if (!map.has(t.column_id)) map.set(t.column_id, [])
      map.get(t.column_id).push(t)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position)
    return map
  }, [columns, tasks])

  const findTask = (id) => tasks.find((t) => t.id === id)

  function onDragStart(e) {
    setActiveTask(findTask(e.active.id))
  }

  function resolveDestination(active, over) {
    if (!over) return null
    // Over a column? Drop at the end.
    const col = columns.find((c) => c.id === over.id)
    if (col) {
      const list = tasksByColumn.get(col.id) || []
      const last = list[list.length - 1]
      return { columnId: col.id, position: positionBetween(last?.position ?? null, null) }
    }
    // Over a task? Drop adjacent.
    const overTask = findTask(over.id)
    if (overTask) {
      const list = tasksByColumn.get(overTask.column_id) || []
      const idx = list.findIndex((t) => t.id === overTask.id)
      const activeTaskRow = findTask(active.id)
      // If reordering within the same column and moving down, insert AFTER over; otherwise BEFORE.
      const before = activeTaskRow?.column_id === overTask.column_id && (activeTaskRow?.position ?? 0) < (overTask.position ?? 0)
        ? overTask.position
        : list[idx - 1]?.position ?? null
      const after = activeTaskRow?.column_id === overTask.column_id && (activeTaskRow?.position ?? 0) < (overTask.position ?? 0)
        ? list[idx + 1]?.position ?? null
        : overTask.position
      return { columnId: overTask.column_id, position: positionBetween(before, after) }
    }
    return null
  }

  async function onDragEnd(e) {
    setActiveTask(null)
    const dest = resolveDestination(e.active, e.over)
    if (!dest) return
    const t = findTask(e.active.id)
    if (!t) return
    if (t.column_id === dest.columnId && t.position === dest.position) return
    updateTask.mutate({ id: t.id, patch: { column_id: dest.columnId, position: dest.position } })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveTask(null)}>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 snap-x">
          {columns.map((col) => (
            <SortableContext key={col.id} id={col.id} items={(tasksByColumn.get(col.id) || []).map((t) => t.id)}>
              <KanbanColumn column={col} tasks={tasksByColumn.get(col.id) || []} onTaskClick={onTaskClick} />
            </SortableContext>
          ))}
        </div>
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} asOverlay /> : null}</DragOverlay>
    </DndContext>
  )
}
