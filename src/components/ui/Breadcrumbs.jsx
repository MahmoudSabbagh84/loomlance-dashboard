import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from './cn'

// items: [{ label, to? }] — the last item is the current page (rendered as plain text).
export function Breadcrumbs({ items = [], className }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-sm text-fg-muted', className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1
        return (
          <span key={i} className="flex min-w-0 items-center gap-1">
            {item.to && !last ? (
              <Link to={item.to} className="shrink-0 transition-colors hover:text-fg">
                {item.label}
              </Link>
            ) : (
              <span className={cn('truncate', last && 'font-medium text-fg')}>{item.label}</span>
            )}
            {!last ? <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" /> : null}
          </span>
        )
      })}
    </nav>
  )
}
