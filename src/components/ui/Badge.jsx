import { cn } from './cn'

const VARIANTS = {
  default: 'bg-bg-muted text-fg-muted',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  primary: 'bg-primary/15 text-primary',
}

const SIZES = {
  sm: 'gap-1 px-2 py-0.5 text-xs font-medium',
  lg: 'gap-1.5 px-3 py-1 text-sm font-semibold',
}

export function Badge({ variant = 'default', size = 'sm', className, children }) {
  return (
    <span className={cn('inline-flex items-center rounded-full tabular-nums', SIZES[size], VARIANTS[variant], className)}>
      {children}
    </span>
  )
}
