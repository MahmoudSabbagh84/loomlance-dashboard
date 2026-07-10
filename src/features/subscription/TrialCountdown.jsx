import { Clock } from 'lucide-react'
import { formatDate } from '@/lib/date'
import { useCountdown } from './useCountdown'

function Segment({ value, unit }) {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="text-lg font-semibold tabular-nums text-fg">{String(value).padStart(2, '0')}</span>
      <span className="mt-1 text-xs font-medium text-fg-muted">{unit}</span>
    </div>
  )
}

// The trial "treatment" in the Current-plan card: a live days/hours/minutes countdown to the
// trial end. Uses the brand violet at low tint (active/positive state), flat with a hairline —
// no shadow, no gradient. Once the trial elapses (webhook lag before the plan finalizes) it
// falls back to a quiet finalizing note rather than showing 00 · 00 · 00.
export function TrialCountdown({ endsAt, planName, canceling = false }) {
  const { days, hours, minutes, expired } = useCountdown(endsAt)

  if (expired) {
    return (
      <p className="mt-3 rounded-lg border border-border bg-bg-muted px-3.5 py-3 text-sm text-fg-muted">
        {canceling
          ? 'Your free trial has ended and won’t convert to a paid plan.'
          : `Your free trial has ended — finalizing your ${planName} plan. This can take a moment.`}
      </p>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/[0.06] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm">
        <Clock className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="font-medium text-fg">Free trial</span>
        <span className="text-fg-muted">· ends {formatDate(endsAt)}{canceling ? ' · won’t renew' : ''}</span>
      </div>
      <div
        role="timer"
        aria-label={`Trial ends in ${days} days, ${hours} hours, ${minutes} minutes`}
        className="flex items-center gap-4 self-end sm:self-auto"
      >
        <Segment value={days} unit="days" />
        <Segment value={hours} unit="hrs" />
        <Segment value={minutes} unit="min" />
      </div>
    </div>
  )
}
