import { forwardRef } from 'react'
import { cn } from './cn'

export const Input = forwardRef(function Input({ className, type = 'text', ...rest }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-9 w-full rounded-md border border-border bg-bg-muted px-3 text-sm text-fg transition-colors',
        'placeholder:text-fg-subtle hover:border-border-strong',
        'focus:border-primary focus:bg-bg-elevated',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...rest}
    />
  )
})
