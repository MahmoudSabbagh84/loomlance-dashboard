import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileCheck,
  FileText,
  Clock,
  Receipt,
  BarChart3,
  Lock,
} from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useProfile } from '@/hooks/useProfile'
import { hasFeature, FEATURES } from '@/lib/tier'
import { useState } from 'react'
import { UpgradeDialog } from '@/components/gates/UpgradeDialog'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: Briefcase },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/contracts', label: 'Contracts', icon: FileCheck },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/time', label: 'Time', icon: Clock, feature: FEATURES.TIME_TRACKING, target: 'tier_1' },
  { to: '/expenses', label: 'Expenses', icon: Receipt, feature: FEATURES.EXPENSES, target: 'tier_2' },
  { to: '/reports', label: 'Reports', icon: BarChart3, feature: FEATURES.REPORTS, target: 'tier_2' },
]

export function Sidebar() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [lockedFeature, setLockedFeature] = useState(null)

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-bg-elevated">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <img src="/logo.png" alt="" className="size-8" />
        <span className="ml-2 font-bold">
          <span className="text-primary">Loom</span>
          <span className="text-fg-muted">Lance</span>
        </span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon
          const locked = item.feature && !hasFeature(tier, item.feature)
          if (locked) {
            return (
              <button
                key={item.label}
                onClick={() => setLockedFeature({ feature: item.feature, target: item.target })}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-fg-subtle hover:bg-bg-muted"
              >
                <Icon className="size-4" />
                <span className="flex-1 text-left">{item.label}</span>
                <Lock className="size-3" />
              </button>
            )
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:text-fg hover:bg-bg-muted'
                )
              }
            >
              <Icon className="size-4" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
      {lockedFeature ? (
        <UpgradeDialog
          open
          onClose={() => setLockedFeature(null)}
          feature={lockedFeature.feature}
          currentTier={tier}
          target={lockedFeature.target}
        />
      ) : null}
    </aside>
  )
}
