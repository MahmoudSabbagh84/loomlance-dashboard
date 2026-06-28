import { useState } from 'react'
import { Plus, Briefcase, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { useProjects, useActiveProjectCount } from '@/hooks/useProjects'
import { useProfile } from '@/hooks/useProfile'
import { canCreateProject, TIER_LIMITS } from '@/lib/tier'
import { UpgradeDialog } from '@/components/gates/UpgradeDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toolbar } from '@/components/ui/Toolbar'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { ProjectCard } from '@/features/projects/ProjectCard'

export default function ProjectsPage() {
  const [status, setStatus] = useState('active')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const { data: profile } = useProfile()
  const { data: projects = [], isLoading } = useProjects({ status, search })
  const { data: activeCount = 0 } = useActiveProjectCount()
  const hasActiveFilters = status !== 'active' || search.trim().length > 0
  const tier = profile?.subscription_tier ?? 'free'
  const limit = TIER_LIMITS[tier].maxActiveProjects
  const limitText = limit === Infinity ? 'Unlimited' : `${activeCount} / ${limit}`

  const handleNewClick = () => {
    if (!canCreateProject(tier, activeCount)) {
      setUpgradeOpen(true)
    } else {
      setFormOpen(true)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        subtitle={<>Active projects: <Badge variant="primary">{limitText}</Badge></>}
      >
        <Button onClick={handleNewClick}><Plus className="size-4" /> New project</Button>
      </PageHeader>

      <Toolbar>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </Select>
        <Input placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </Toolbar>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : projects.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={SearchX}
            title="No matches"
            description="No projects match your filters."
            action={<Button variant="secondary" onClick={() => { setStatus('active'); setSearch('') }}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            icon={Briefcase}
            title="No projects yet"
            description="Create a project to organize work, track time, and bill against it."
            action={<Button onClick={handleNewClick}><Plus className="size-4" /> New project</Button>}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {formOpen ? <ProjectFormModal open onClose={() => setFormOpen(false)} /> : null}
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
