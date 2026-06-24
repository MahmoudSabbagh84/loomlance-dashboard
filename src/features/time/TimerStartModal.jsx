import { useState } from 'react'
import { Play } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { useProfile } from '@/hooks/useProfile'
import { useProjects } from '@/hooks/useProjects'
import { useTaggableContracts } from '@/hooks/useContracts'
import { useStartTimer } from '@/hooks/useTimeEntries'

// Picks what a new timer tracks (project → its client → optional contract) and starts it.
// Lifted out of the old topbar clock popover so the timer controls can live inline.
export function TimerStartModal({ open, onClose, running }) {
  const { data: profile } = useProfile()
  const { data: projects = [] } = useProjects({ status: 'active' })
  const start = useStartTimer()
  const [projectId, setProjectId] = useState('')
  const [contractId, setContractId] = useState('')

  const project = projects.find((p) => p.id === projectId)
  const { data: contracts = [] } = useTaggableContracts(projectId, project?.client_id)

  const close = () => {
    setProjectId('')
    setContractId('')
    onClose()
  }

  const onStart = async () => {
    if (!projectId) return
    const contract = contracts.find((c) => c.id === contractId)
    const hourlyRate = contract?.hourly_rate ?? profile?.default_hourly_rate ?? null
    try {
      await start.mutateAsync({ projectId, contractId: contractId || null, hourlyRate })
      toast.success('Timer started')
      close()
    } catch (e) {
      toast.error(e.userMessage || 'Could not start timer')
    }
  }

  return (
    <Modal open={open} onClose={close} title="Start a timer" size="sm">
      {running ? (
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            You&apos;re already tracking time on{' '}
            <span className="font-medium text-fg">{running.projects?.name || 'a project'}</span>. Commit or discard it
            before starting a new one.
          </p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="timer-project">Project</Label>
            <Select
              id="timer-project"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value)
                setContractId('')
              }}
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          {project ? (
            <div>
              <Label>Client</Label>
              <p className="flex h-9 items-center rounded-md border border-border bg-bg-muted px-3 text-sm text-fg-muted">
                {project.clients?.name || 'No client on this project'}
              </p>
            </div>
          ) : null}

          {projectId && contracts.length > 0 ? (
            <div>
              <Label htmlFor="timer-contract">
                Contract <span className="font-normal text-fg-subtle">· optional</span>
              </Label>
              <Select id="timer-contract" value={contractId} onChange={(e) => setContractId(e.target.value)}>
                <option value="">No contract</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={onStart} loading={start.isPending} disabled={!projectId}>
              <Play className="size-4" /> Start timer
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
