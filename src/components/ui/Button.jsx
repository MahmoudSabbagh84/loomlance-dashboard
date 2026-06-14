import { forwardRef } from 'react'
import { cn } from './cn'

const VARIANTS = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-bg-elevated text-fg border border-border hover:bg-bg-muted',
  danger: 'bg-danger text-white hover:opacity-90',
  ghost: 'text-fg-muted hover:text-fg hover:bg-bg-muted',
  link: 'text-primary underline-offset-2 hover:underline px-0 py-0',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', disabled, loading, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <span className="size-4 animate-spin border-2 border-current border-r-transparent rounded-full" /> : null}
      {children}
    </button>
  )
})
