import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// Shown when a paid signup bailed out of Stripe Checkout (customer exists, no subscription).
// Lets them resume the 14-day trial, or dismiss to stay on Solo.
export function TrialResumeBanner({ planName, onResume, onDismiss }) {
  return (
    <div
      role="region"
      aria-label="Trial"
      className="mb-5 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-fg">
          <span className="font-semibold">Pick up where you left off</span>
          <span className="text-fg-muted"> — you chose {planName} at signup but didn’t finish checkout. Start your 14-day free trial, cancel anytime before it ends.</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <Button size="sm" onClick={onResume}>
          Start 14-day trial
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="grid size-8 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
