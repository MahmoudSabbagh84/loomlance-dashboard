import { Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from './cn'

// Replaces the manual Save button: reflects useAutosave's status.
export function SaveStatus({ status, onRetry, className }) {
  if (status === 'saving') {
    return (
      <span className={cn('flex items-center gap-1.5 text-xs text-fg-muted', className)}>
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className={cn('flex items-center gap-1.5 text-xs text-success', className)}>
        <Check className="size-3.5" /> Saved
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className={cn('flex items-center gap-1.5 text-xs text-danger', className)}>
        <AlertCircle className="size-3.5" /> Couldn&apos;t save
        {onRetry ? (
          <button type="button" onClick={onRetry} className="font-medium underline hover:no-underline">
            Retry
          </button>
        ) : null}
      </span>
    )
  }
  return null
}
