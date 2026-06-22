import { useState } from 'react'
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

export function SidebarNav({ onNavigate }) {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [lockedFeature, setLockedFeature] = useState(null)

  return (
    <>
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map((item) => {
          const Icon = item.icon
          const locked = item.feature && !hasFeature(tier, item.feature)
          if (locked) {
            return (
              <button
                key={item.label}
                onClick={() => setLockedFeature({ feature: item.feature, target: item.target })}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-fg-subtle transition-colors hover:bg-bg-muted hover:text-fg-muted"
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
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/12 font-medium text-primary'
                    : 'text-fg-muted hover:bg-bg-muted hover:text-fg'
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
    </>
  )
}
