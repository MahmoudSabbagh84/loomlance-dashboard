import { cn } from './cn'

const VARIANTS = {
  default: 'bg-bg-muted text-fg-muted',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  primary: 'bg-primary/15 text-primary',
}

export function Badge({ variant = 'default', className, children }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums', VARIANTS[variant], className)}>
      {children}
    </span>
  )
}
