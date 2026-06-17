import { forwardRef } from 'react'
import { cn } from './cn'

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-border bg-bg-muted px-3 text-sm text-fg transition-colors',
        'hover:border-border-strong focus:border-primary',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  )
})
