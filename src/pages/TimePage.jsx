import { useState } from 'react'
import { Plus, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toolbar } from '@/components/ui/Toolbar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useProjects } from '@/hooks/useProjects'
import { hasFeature, FEATURES } from '@/lib/tier'
import { formatDuration } from '@/lib/time'
import { useTimeEntries, useDeleteEntry } from '@/hooks/useTimeEntries'
import { TimeEntriesTable } from '@/features/time/TimeEntriesTable'
import { TimeEntryFormModal } from '@/features/time/TimeEntryFormModal'
import { GenerateInvoiceModal } from '@/features/time/GenerateInvoiceModal'

export default function TimePage() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const { data: projects = [] } = useProjects({ status: 'all' })
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [genOpen, setGenOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const del = useDeleteEntry()
  const { data: entries = [], isLoading } = useTimeEntries({ projectId: projectId || undefined, status })

  if (!hasFeature(tier, FEATURES.TIME_TRACKING)) {
    return (
      <div className="space-y-5">
        <PageHeader title="Time" />
        <UpgradeCard feature={FEATURES.TIME_TRACKING} currentTier={tier} target="tier_1" />
      </div>
    )
  }

  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader title="Time" subtitle="Track hours and bill them">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setGenOpen(true)}>
            <FileText className="size-4" /> Generate invoice
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="size-4" /> Log time
          </Button>
        </div>
      </PageHeader>

      <Toolbar>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-44">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
          <option value="all">All</option>
          <option value="unbilled">Unbilled</option>
          <option value="billed">Billed</option>
        </Select>
        <label className="ml-auto flex items-center gap-2 text-xs text-fg-muted">
          Default rate
          <Input
            type="number"
            step="0.01"
            defaultValue={profile?.default_hourly_rate ?? ''}
            className="h-8 w-24"
            onBlur={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              if (v !== (profile?.default_hourly_rate ?? null)) update.mutate({ default_hourly_rate: v })
            }}
          />
        </label>
      </Toolbar>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No time logged"
          description="Start the timer in the top bar or log time manually."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> Log time</Button>}
        />
      ) : (
        <>
          <TimeEntriesTable
            entries={entries}
            currency={profile?.default_currency || 'USD'}
            onEdit={(e) => { setEditing(e); setFormOpen(true) }}
            onDelete={setToDelete}
          />
          <p className="text-right text-sm text-fg-muted">
            Total: <span className="font-medium tabular-nums text-fg">{formatDuration(totalMinutes)}</span>
          </p>
        </>
      )}

      {formOpen ? <TimeEntryFormModal open onClose={() => setFormOpen(false)} entry={editing} /> : null}
      {genOpen ? <GenerateInvoiceModal open onClose={() => setGenOpen(false)} /> : null}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete time entry?"
        body="This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={del.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          try {
            await del.mutateAsync(toDelete.id)
            toast.success('Deleted')
            setToDelete(null)
          } catch (e) {
            toast.error(e.userMessage)
          }
        }}
      />
    </div>
  )
}
