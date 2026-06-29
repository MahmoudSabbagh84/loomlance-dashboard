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
import { useProject } from '@/hooks/useProjects'
import { positionBetween } from '@/api/tasks'
import { daysUntil } from '@/lib/date'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'
import { KanbanFilters } from './KanbanFilters'
import { AddColumn } from './AddColumn'

const EMPTY_FILTERS = { search: '', priority: '', dueSoon: false, hideDone: false }

export function KanbanBoard({ projectId, onTaskClick }) {
  const { data: columns = [] } = useKanbanColumns(projectId)
  const { data: tasks = [] } = useTasks(projectId)
  const updateTask = useUpdateTask(projectId)
  const { data: project } = useProject(projectId)
  const taskKey = project?.task_key
  const [activeTask, setActiveTask] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

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

  const filteredTasksByColumn = useMemo(() => {
    const out = new Map()
    const doneColumnIds = new Set(columns.filter((c) => /done/i.test(c.name)).map((c) => c.id))
    const term = filters.search.trim().toLowerCase()
    for (const [col, list] of tasksByColumn) {
      let next = list
      if (term) next = next.filter((t) => t.title.toLowerCase().includes(term))
      if (filters.priority) next = next.filter((t) => t.priority === filters.priority)
      if (filters.dueSoon) next = next.filter((t) => t.due_date && daysUntil(t.due_date) <= 7)
      if (filters.hideDone && doneColumnIds.has(col)) next = []
      out.set(col, next)
    }
    return out
  }, [tasksByColumn, filters, columns])

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

  // Screen-reader announcements for keyboard drag-and-drop (WCAG 4.1.3).
  const columnName = (id) => columns.find((c) => c.id === id)?.name ?? 'a column'
  const overName = (over) =>
    columns.some((c) => c.id === over.id) ? columnName(over.id) : columnName(findTask(over.id)?.column_id)
  const announcements = {
    onDragStart: ({ active }) => `Picked up task ${findTask(active.id)?.title ?? ''}.`,
    onDragOver: ({ active, over }) =>
      over ? `Task ${findTask(active.id)?.title ?? ''} moved over ${overName(over)}.` : '',
    onDragEnd: ({ active, over }) =>
      over
        ? `Task ${findTask(active.id)?.title ?? ''} dropped into ${overName(over)}.`
        : `Task ${findTask(active.id)?.title ?? ''} dropped.`,
    onDragCancel: ({ active }) => `Dragging cancelled. Task ${findTask(active.id)?.title ?? ''} returned.`,
  }

  return (
    <div className="space-y-3">
      <KanbanFilters value={filters} onChange={setFilters} />
      <DndContext sensors={sensors} collisionDetection={closestCorners} accessibility={{ announcements }} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveTask(null)}>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-start gap-3 snap-x">
            {columns.map((col) => (
              <SortableContext key={col.id} id={col.id} items={(filteredTasksByColumn.get(col.id) || []).map((t) => t.id)}>
                <KanbanColumn column={col} tasks={filteredTasksByColumn.get(col.id) || []} onTaskClick={onTaskClick} taskKey={taskKey} />
              </SortableContext>
            ))}
            <AddColumn projectId={projectId} position={columns.length} />
          </div>
        </div>
        <DragOverlay>{activeTask ? <TaskCard task={activeTask} taskKey={taskKey} asOverlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  )
}
