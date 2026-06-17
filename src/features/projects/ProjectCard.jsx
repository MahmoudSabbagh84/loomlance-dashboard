import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { Card } from '@/components/ui/Card'

export function ProjectCard({ project }) {
  const { data: tasks = [] } = useTasks(project.id)
  const openCount = tasks.length
  return (
    <Card as={Link} to={`/projects/${project.id}`} className="block transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-md" style={{ backgroundColor: project.color + '22' }}>
          <Briefcase className="size-5" style={{ color: project.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{project.name}</p>
          <p className="truncate text-xs text-fg-muted">{project.clients?.name}</p>
          <p className="mt-2 text-xs tabular-nums text-fg-subtle">{openCount} open tasks</p>
        </div>
      </div>
    </Card>
  )
}
