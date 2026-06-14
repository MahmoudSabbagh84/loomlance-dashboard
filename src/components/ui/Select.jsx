import { forwardRef } from 'react'
import { cn } from './cn'

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  )
})
