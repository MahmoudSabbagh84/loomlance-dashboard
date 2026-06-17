import { DollarSign, Clock, AlertTriangle, Briefcase } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useProfile } from '@/hooks/useProfile'
import { TIER_LIMITS } from '@/lib/tier'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'

function CurrencyList({ map }) {
  const entries = Object.entries(map || {})
  if (!entries.length) return <span className="text-fg-muted">—</span>
  return (
    <div className="flex flex-col">
      {entries.slice(0, 2).map(([c, a]) => (
        <span key={c}>{formatCurrency(a, c)}</span>
      ))}
      {entries.length > 2 ? <span className="text-xs text-fg-muted">+{entries.length - 2} more</span> : null}
    </div>
  )
}

function StatCard({ icon: Icon, label, children }) {
  return (
    <Card className="flex items-start gap-3">
      <div className="rounded-md bg-primary/10 p-2">
        <Icon className="size-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-fg-muted">{label}</p>
        <div className="mt-1 text-xl font-semibold tabular-nums">{children}</div>
      </div>
    </Card>
  )
}

export function StatsRow() {
  const { data: stats, isLoading } = useDashboardStats()
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const limit = TIER_LIMITS[tier].maxActiveProjects

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={DollarSign} label="Revenue this month"><CurrencyList map={stats.revenueByCurrency} /></StatCard>
      <StatCard icon={Clock} label="Outstanding"><CurrencyList map={stats.outstandingByCurrency} /></StatCard>
      <StatCard icon={AlertTriangle} label="Open invoices">{stats.overdueCount}</StatCard>
      <StatCard icon={Briefcase} label="Active projects">
        {stats.activeProjectCount} {limit === Infinity ? '' : <span className="text-sm text-fg-muted">/ {limit}</span>}
      </StatCard>
    </div>
  )
}
