import { forwardRef } from 'react'
import { cn } from './cn'

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full rounded-md border border-border bg-bg-muted px-3 py-2 text-sm text-fg transition-colors',
        'placeholder:text-fg-subtle hover:border-border-strong focus:border-primary focus:bg-bg-elevated',
        className
      )}
      {...rest}
    />
  )
})
