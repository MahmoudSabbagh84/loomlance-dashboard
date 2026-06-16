import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { KanbanBoard } from '@/features/kanban/KanbanBoard'
import { TaskDrawer } from '@/features/kanban/TaskDrawer'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, isLoading, error } = useProject(id)
  const [drawerTask, setDrawerTask] = useState(null)

  if (isLoading) return <Skeleton className="h-64" />
  if (error || !project) return <p>Project not found. <button onClick={() => navigate('/projects')} className="text-primary underline">Back</button></p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-fg-muted">{project.clients?.name}</p>
      </div>
      <KanbanBoard projectId={project.id} onTaskClick={setDrawerTask} />
      <TaskDrawer open={!!drawerTask} onClose={() => setDrawerTask(null)} projectId={project.id} task={drawerTask} />
    </div>
  )
}
