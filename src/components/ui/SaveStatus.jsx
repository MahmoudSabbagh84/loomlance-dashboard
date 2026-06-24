import { Check, Loader2, AlertCircle, AlertTriangle } from 'lucide-react'
import { cn } from './cn'

// Replaces the manual Save button: reflects useAutosave's status.
// Always renders a live region (even when idle) so screen readers announce
// saving/saved/error/invalid transitions — the editor & several tabs are autosave-only.
export function SaveStatus({ status, onRetry, className }) {
  const isError = status === 'error'
  const isInvalid = status === 'invalid'
  return (
    <span
      role={isError || isInvalid ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn('flex items-center gap-1.5 text-xs', className)}
    >
      {status === 'saving' ? (
        <span className="flex items-center gap-1.5 text-fg-muted">
          <Loader2 className="size-3.5 animate-spin" /> Saving…
        </span>
      ) : null}
      {status === 'saved' ? (
        <span className="flex items-center gap-1.5 text-success">
          <Check className="size-3.5" /> Saved
        </span>
      ) : null}
      {isInvalid ? (
        <span className="flex items-center gap-1.5 text-warning">
          <AlertTriangle className="size-3.5" /> Not saved — fix errors
        </span>
      ) : null}
      {isError ? (
        <span className="flex items-center gap-1.5 text-danger">
          <AlertCircle className="size-3.5" /> Couldn&apos;t save
          {onRetry ? (
            <button type="button" onClick={onRetry} className="font-medium underline hover:no-underline">
              Retry
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
