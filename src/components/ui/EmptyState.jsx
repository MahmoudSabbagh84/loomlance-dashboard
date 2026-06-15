import { cn } from './cn'

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      {Icon ? <Icon className="size-12 text-fg-subtle mb-4" /> : null}
      <h3 className="text-base font-semibold text-fg mb-1">{title}</h3>
      {description ? <p className="text-sm text-fg-muted mb-5 max-w-md">{description}</p> : null}
      {action}
    </div>
  )
}
