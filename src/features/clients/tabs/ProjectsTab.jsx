import { useState } from 'react'
import { Plus, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useProjects, useActiveProjectCount } from '@/hooks/useProjects'
import { useProfile } from '@/hooks/useProfile'
import { canCreateProject } from '@/lib/tier'
import { UpgradeDialog } from '@/components/gates/UpgradeDialog'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { ProjectCard } from '@/features/projects/ProjectCard'

export function ProjectsTab({ clientId }) {
  const { data: projects = [], isLoading } = useProjects({ clientId, status: 'all' })
  const { data: profile } = useProfile()
  const { data: activeCount = 0 } = useActiveProjectCount()
  const [formOpen, setFormOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const tier = profile?.subscription_tier ?? 'free'

  const handleNewClick = () => {
    if (!canCreateProject(tier, activeCount)) setUpgradeOpen(true)
    else setFormOpen(true)
  }

  if (isLoading) return <p className="text-sm text-fg-muted">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleNewClick}><Plus className="size-4" /> New project</Button>
      </div>
      {projects.length === 0 ? (
        <EmptyState icon={Briefcase} title="No projects for this client" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
      {formOpen ? <ProjectFormModal open onClose={() => setFormOpen(false)} defaultClientId={clientId} /> : null}
      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature="active_projects"
        currentTier={tier}
        target={tier === 'free' ? 'tier_1' : 'tier_2'}
      />
    </div>
  )
}
