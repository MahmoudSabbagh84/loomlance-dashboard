import { cn } from './cn'

export function PageHeader({ title, subtitle, children, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  )
}
