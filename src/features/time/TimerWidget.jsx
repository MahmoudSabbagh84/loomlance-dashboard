import { useState, useEffect, useRef } from 'react'
import { Play, Square, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/components/ui/cn'
import { useProfile } from '@/hooks/useProfile'
import { useProjects } from '@/hooks/useProjects'
import { useTaggableContracts } from '@/hooks/useContracts'
import { hasFeature, FEATURES } from '@/lib/tier'
import { formatElapsed } from '@/lib/time'
import { useRunningTimer, useStartTimer, useStopTimer } from '@/hooks/useTimeEntries'

export function TimerWidget() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const { data: running } = useRunningTimer()
  const start = useStartTimer()
  const stop = useStopTimer()
  const { data: projects = [] } = useProjects({ status: 'active' })
  const [open, setOpen] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [contractId, setContractId] = useState('')
  const clientId = projects.find((p) => p.id === projectId)?.client_id
  const { data: contracts = [] } = useTaggableContracts(projectId, clientId)
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    if (!running) return
    const tick = () => setElapsed((Date.now() - new Date(running.started_at).getTime()) / 1000)
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [running])

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

  const onStop = async () => {
    try {
      await stop.mutateAsync(running.id)
      toast.success('Timer stopped')
    } catch (e) {
      toast.error(e.userMessage || 'Could not stop timer')
    }
  }

  if (running) {
    return (
      <button
        onClick={onStop}
        title={`Stop timer · ${running.projects?.name ?? ''}`}
        className="flex h-9 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
      >
        <span className="tabular-nums">{formatElapsed(elapsed)}</span>
        <Square className="size-3.5 fill-current" />
      </button>
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
