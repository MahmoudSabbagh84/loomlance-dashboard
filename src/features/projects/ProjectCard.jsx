import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'

export function ProjectCard({ project }) {
  const { data: tasks = [] } = useTasks(project.id)
  const openCount = tasks.length
  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-lg border border-border bg-bg-elevated p-4 hover:border-border-strong transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md p-2" style={{ backgroundColor: project.color + '22' }}>
          <Briefcase className="size-5" style={{ color: project.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{project.name}</p>
          <p className="text-xs text-fg-muted truncate">{project.clients?.name}</p>
          <p className="mt-2 text-xs text-fg-subtle">{openCount} open tasks</p>
        </div>
      </div>
    </Link>
  )
}
