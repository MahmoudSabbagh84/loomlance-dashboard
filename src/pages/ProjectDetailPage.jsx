import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { KanbanBoard } from '@/features/kanban/KanbanBoard'
import { TaskDrawer } from '@/features/kanban/TaskDrawer'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { ProjectFinancialsPanel } from '@/features/projects/ProjectFinancialsPanel'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, isLoading, error } = useProject(id)
  const [drawerTask, setDrawerTask] = useState(null)

  if (isLoading) return <Skeleton className="h-64" />
  if (error || !project) return <p>Project not found. <button onClick={() => navigate('/projects')} className="text-primary underline">Back</button></p>

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Projects', to: '/projects' }, { label: project.name }]} />
      <PageHeader title={project.name} subtitle={project.clients?.name} />
      <ProjectFinancialsPanel project={project} />
      <KanbanBoard projectId={project.id} onTaskClick={setDrawerTask} />
      <TaskDrawer open={!!drawerTask} onClose={() => setDrawerTask(null)} projectId={project.id} task={drawerTask} />
    </div>
  )
}
