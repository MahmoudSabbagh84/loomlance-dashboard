import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Check, X, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/components/ui/cn'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useProfile } from '@/hooks/useProfile'
import { useProjects } from '@/hooks/useProjects'
import { useTaggableContracts } from '@/hooks/useContracts'
import { hasFeature, FEATURES } from '@/lib/tier'
import { formatElapsed, activeSeconds } from '@/lib/time'
import {
  useRunningTimer,
  useStartTimer,
  useStopTimer,
  usePauseTimer,
  useResumeTimer,
  useDeleteEntry,
} from '@/hooks/useTimeEntries'

export function TimerWidget() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const { data: running } = useRunningTimer()
  const start = useStartTimer()
  const stop = useStopTimer()
  const pause = usePauseTimer()
  const resume = useResumeTimer()
  const del = useDeleteEntry()
  const { data: projects = [] } = useProjects({ status: 'active' })
  const [open, setOpen] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [contractId, setContractId] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const clientId = projects.find((p) => p.id === projectId)?.client_id
  const { data: contracts = [] } = useTaggableContracts(projectId, clientId)
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef(null)

  const isPaused = !!running?.paused_at

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    if (!running) {
      setElapsed(0)
      return
    }
    const tick = () => setElapsed(activeSeconds(running, Date.now()))
    tick()
    if (isPaused) return // frozen while paused
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [running, isPaused])

  if (!hasFeature(tier, FEATURES.TIME_TRACKING)) return null

  const onStart = async () => {
    if (!projectId) return
    const contract = contracts.find((c) => c.id === contractId)
    const hourlyRate = contract?.hourly_rate ?? profile?.default_hourly_rate ?? null
    try {
      await start.mutateAsync({ projectId, contractId: contractId || null, hourlyRate })
      setOpen(false)
      setProjectId('')
      setContractId('')
    } catch (e) {
      toast.error(e.userMessage || 'Could not start timer')
    }
  }

  const onPauseResume = async () => {
    try {
      if (isPaused) await resume.mutateAsync(running.id)
      else await pause.mutateAsync(running.id)
    } catch (e) {
      toast.error(e.userMessage || 'Could not update timer')
    }
  }

  const onCommit = async () => {
    try {
      await stop.mutateAsync(running.id)
      toast.success('Time committed')
    } catch (e) {
      toast.error(e.userMessage || 'Could not commit time')
    }
  }

  const onDiscard = async () => {
    try {
      await del.mutateAsync(running.id)
      setConfirmDiscard(false)
      toast.success('Timer discarded')
    } catch (e) {
      toast.error(e.userMessage || 'Could not discard timer')
    }
  }

  if (running) {
    const project = running.projects?.name ?? ''
    return (
      <>
        <div
          className={cn(
            'flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm font-medium',
            isPaused ? 'border-warning/40 bg-warning/10 text-warning' : 'border-primary/40 bg-primary/10 text-primary',
          )}
          title={`${isPaused ? 'Paused' : 'Tracking'} · ${project}`}
        >
          <span
            className={cn('size-2 shrink-0 rounded-full', isPaused ? 'bg-warning' : 'animate-breathe bg-danger')}
            aria-hidden
          />
          <span className="tabular-nums">{formatElapsed(elapsed)}</span>
          <button
            onClick={onPauseResume}
            className="grid size-6 place-items-center rounded transition-colors hover:bg-bg-muted"
            aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
          >
            {isPaused ? <Play className="size-3.5 fill-current" /> : <Pause className="size-3.5 fill-current" />}
          </button>
          <button
            onClick={onCommit}
            className="grid size-6 place-items-center rounded text-success transition-colors hover:bg-success/15"
            aria-label="Commit time"
          >
            <Check className="size-4" />
          </button>
          <button
            onClick={() => setConfirmDiscard(true)}
            className="grid size-6 place-items-center rounded text-fg-subtle transition-colors hover:bg-danger/15 hover:text-danger"
            aria-label="Discard timer"
          >
            <X className="size-4" />
          </button>
        </div>
        <ConfirmDialog
          open={confirmDiscard}
          title="Discard timer?"
          body="This deletes the in-progress entry without saving any time. This can't be undone."
          confirmLabel="Discard"
          variant="danger"
          loading={del.isPending}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={onDiscard}
        />
      </>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Start timer"
        className="grid size-9 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
      >
        <Clock className="size-5" />
      </button>
      {open ? (
        <div className="animate-pop-in absolute right-0 mt-2 w-64 rounded-lg border border-border bg-bg-elevated p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium text-fg-muted">Start a timer</p>
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setContractId('') }}
            className="mb-2 h-9 w-full rounded-md border border-border bg-bg-muted px-2 text-sm"
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {projectId && contracts.length > 0 ? (
            <select
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              className="mb-2 h-9 w-full rounded-md border border-border bg-bg-muted px-2 text-sm"
            >
              <option value="">No contract</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          ) : null}
          <button
            onClick={onStart}
            disabled={!projectId || start.isPending}
            className={cn(
              'flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-fg',
              (!projectId || start.isPending) && 'opacity-50'
            )}
          >
            <Play className="size-4" /> Start
          </button>
        </div>
      ) : null}
    </div>
  )
}
