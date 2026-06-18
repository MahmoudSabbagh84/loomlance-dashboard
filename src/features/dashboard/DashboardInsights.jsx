import { Suspense, lazy, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { useInsights } from '@/hooks/useInsights'
import { useProfile } from '@/hooks/useProfile'
import { TopClients } from './TopClients'

const RevenueChart = lazy(() => import('./RevenueChart'))

export function DashboardInsights() {
  const { data, isLoading } = useInsights()
  const { data: profile } = useProfile()
  const [picked, setPicked] = useState(null)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  const currencies = data?.currencies ?? []
  if (currencies.length === 0) {
    return (
      <Card>
        <h3 className="mb-1 text-sm font-semibold">Revenue</h3>
        <p className="text-sm text-fg-muted">No revenue recorded yet — paid invoices will show up here.</p>
      </Card>
    )
  }

  const fallback = currencies.includes(profile?.default_currency) ? profile.default_currency : currencies[0]
  const currency = picked && currencies.includes(picked) ? picked : fallback
  const bucket = data.byCurrency[currency]
  const chartData = data.months.map((m) => ({ label: m.label, revenue: bucket?.monthTotals[m.key] || 0 }))

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Revenue · last 6 months</h3>
          {currencies.length > 1 ? (
            <div className="flex gap-1">
              {currencies.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPicked(c)}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-medium tabular-nums transition-colors',
                    c === currency ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-bg-muted'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <RevenueChart data={chartData} currency={currency} />
        </Suspense>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">Top clients{currencies.length > 1 ? ` · ${currency}` : ''}</h3>
        <TopClients clientTotals={bucket?.clientTotals} currency={currency} />
      </Card>
    </div>
  )
}
