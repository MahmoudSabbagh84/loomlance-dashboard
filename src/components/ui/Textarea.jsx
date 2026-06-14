import { forwardRef } from 'react'
import { cn } from './cn'

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg',
        'placeholder:text-fg-subtle',
        className
      )}
      {...rest}
    />
  )
})
