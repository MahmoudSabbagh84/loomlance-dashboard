import { useState, useEffect } from 'react'
import { Play, Pause, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/components/ui/cn'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useProfile } from '@/hooks/useProfile'
import { hasFeature, FEATURES } from '@/lib/tier'
import { formatElapsed, activeSeconds } from '@/lib/time'
import { useRunningTimer, useStopTimer, usePauseTimer, useResumeTimer, useDeleteEntry } from '@/hooks/useTimeEntries'
import { TimerStartModal } from './TimerStartModal'

export function TimerWidget() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const { data: running } = useRunningTimer()
  const stop = useStopTimer()
  const pause = usePauseTimer()
  const resume = useResumeTimer()
  const del = useDeleteEntry()
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const isPaused = !!running?.paused_at

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

  return (
    <>
      {running ? (
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm font-medium',
              isPaused ? 'border-warning/40 bg-warning/10 text-warning' : 'border-primary/40 bg-primary/10 text-primary'
            )}
            title={`${isPaused ? 'Paused' : 'Tracking'} · ${running.projects?.name ?? ''}`}
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
              className="grid size-6 place-items-center rounded text-fg-muted transition-colors hover:bg-danger/15 hover:text-danger"
              aria-label="Discard timer"
            >
              <X className="size-4" />
            </button>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            title={`Tracking ${running.projects?.name ?? ''}`}
            aria-label={`Tracking ${running.projects?.name ?? 'a project'}`}
            className="hidden h-9 max-w-[10rem] items-center rounded-md border border-border bg-bg-muted px-2.5 text-sm text-fg-muted transition-colors hover:border-border-strong hover:text-fg sm:flex"
          >
            <span className="truncate">{running.projects?.name ?? 'No project'}</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          aria-label="Start a timer"
          className="flex h-9 items-center gap-2 rounded-md border border-border bg-bg-muted px-2.5 text-sm font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
        >
          <Play className="size-4 fill-current" />
          <span className="hidden sm:inline">Start timer</span>
        </button>
      )}

      <TimerStartModal open={modalOpen} onClose={() => setModalOpen(false)} running={running} />
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
