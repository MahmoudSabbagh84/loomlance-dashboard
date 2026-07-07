import { NavLink } from 'react-router-dom'
import { cn } from '@/components/ui/cn'

const tabs = [
  { to: '/admin', label: 'Pulse', end: true },
  { to: '/admin/posts', label: 'Posts' },
  { to: '/admin/tools', label: 'Tools' },
]

export function AdminTabs() {
  return (
    <nav aria-label="Admin sections" className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              '-mb-px rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-b-2 border-primary text-primary'
                : 'text-fg-muted hover:text-fg'
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
