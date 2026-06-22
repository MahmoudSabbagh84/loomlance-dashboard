import { AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useProfile } from '@/hooks/useProfile'
import { TIER_LIMITS } from '@/lib/tier'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'

// Hero figure: the first currency large, any others quietly beneath.
function HeroAmount({ map }) {
  const entries = Object.entries(map || {})
  if (!entries.length) return <div className="text-3xl font-semibold text-fg-subtle">—</div>
  const [first, ...rest] = entries
  return (
    <div>
      <div className="text-3xl font-semibold leading-tight tabular-nums">{formatCurrency(first[1], first[0])}</div>
      {rest.length ? (
        <div className="mt-0.5 text-sm tabular-nums text-fg-muted">
          {rest.slice(0, 2).map(([c, a]) => formatCurrency(a, c)).join(' · ')}
          {rest.length > 2 ? ` +${rest.length - 2}` : ''}
        </div>
      ) : null}
    </div>
  )
}

// Compact secondary amount(s): primary currency inline, overflow summarized.
function Amount({ map }) {
  const entries = Object.entries(map || {})
  if (!entries.length) return <span className="text-fg-muted">—</span>
  const [first, ...rest] = entries
  return (
    <span>
      {formatCurrency(first[1], first[0])}
      {rest.length ? <span className="ml-1 text-xs font-normal text-fg-muted">+{rest.length}</span> : null}
    </span>
  )
}

function SecondaryStat({ label, title, tone, children }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-fg-muted" title={title}>{label}</p>
      <div className={cn('mt-1 text-lg font-semibold tabular-nums', tone)}>{children}</div>
    </div>
  )
}

export function StatsRow() {
  const { data: stats, isLoading } = useDashboardStats()
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const limit = TIER_LIMITS[tier].maxActiveProjects

  if (isLoading) return <Skeleton className="h-[104px]" />

  const overdue = stats.overdueCount

  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Hero — revenue leads */}
        <div className="sm:w-60 sm:shrink-0 sm:border-r sm:border-border sm:pr-6">
          <p className="text-sm text-fg-muted" title="Payments received so far this month, grouped by currency">
            Revenue this month
          </p>
          <div className="mt-1">
            <HeroAmount map={stats.revenueByCurrency} />
          </div>
        </div>

        {/* Quiet supporting strip */}
        <div className="grid flex-1 grid-cols-3 gap-4">
          <SecondaryStat label="Outstanding" title="Unpaid invoiced amounts (sent, viewed, or overdue)">
            <Amount map={stats.outstandingByCurrency} />
          </SecondaryStat>
          <SecondaryStat
            label="Overdue"
            title="Invoices past their due date"
            tone={overdue > 0 ? 'text-danger' : undefined}
          >
            <span className="inline-flex items-center gap-1.5">
              {overdue > 0 ? <AlertTriangle className="size-4" /> : null}
              {overdue}
            </span>
          </SecondaryStat>
          <SecondaryStat label="Active projects" title="Projects currently in progress">
            {stats.activeProjectCount}
            {limit === Infinity ? '' : <span className="text-sm font-normal text-fg-muted"> / {limit}</span>}
          </SecondaryStat>
        </div>
      </div>
    </Card>
  )
}
