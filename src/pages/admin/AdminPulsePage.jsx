import { AlertTriangle, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { StatTile } from '@/features/admin/pulse/StatTile'
import SignupsChart from '@/features/admin/pulse/SignupsChart'
import { TierBar } from '@/features/admin/pulse/TierBar'
import { useAdminMetrics } from '@/hooks/useAdminMetrics'
import { formatCurrency } from '@/lib/currency'

function agoLabel(ts) {
  if (!ts) return ''
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000))
  return mins === 0 ? 'Updated just now' : `Updated ${mins} min ago`
}

const USAGE = [
  ['invoicesCreated', 'Invoices created'],
  ['invoicesSent', 'Invoices sent'],
  ['projectsCreated', 'Projects created'],
  ['hoursTracked', 'Hours tracked'],
  ['clientsAdded', 'Clients added'],
]

export default function AdminPulsePage() {
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useAdminMetrics()

  if (isError) {
    return (
      <div className="space-y-5">
        <AdminTabs />
        <PageHeader title="Pulse" />
        <EmptyState
          icon={AlertTriangle}
          title="Couldn’t load metrics"
          description="The metrics service didn’t respond. Your data is unaffected."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </div>
    )
  }

  const signupsThisWeek = data?.users?.signupsByWeek?.at(-1)?.count ?? 0
  const chartData = (data?.users?.signupsByWeek ?? []).map((w) => ({
    label: new Date(`${w.weekStart}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    count: w.count,
  }))

  return (
    <div className="space-y-5">
      <AdminTabs />
      <PageHeader title="Pulse">
        <span className="hidden text-xs text-fg-subtle sm:inline">{agoLabel(dataUpdatedAt)}</span>
        <Button variant="secondary" loading={isFetching} onClick={() => refetch()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Total users" value={data.users.total} />
            <StatTile label="Active (7d)" value={data.users.active7d} />
            <StatTile label="Active (30d)" value={data.users.active30d} />
            <StatTile label="Signups this week" value={signupsThisWeek} />
          </div>

          {data.stripe ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile label="MRR" value={formatCurrency(data.stripe.mrr / 100, data.stripe.currency.toUpperCase())} />
              <StatTile label="Active subscriptions" value={data.stripe.activeSubs} />
              <StatTile label="Trialing now" value={data.stripe.trialing} />
              <StatTile label="Trial conversions" value={data.stripe.trialsConverted} sub={`${data.stripe.trialsChurned} churned`} />
            </div>
          ) : (
            <Card>
              <p className="text-sm font-medium text-fg">Stripe unavailable — showing database metrics only.</p>
              <p className="mt-1 text-sm text-fg-muted">MRR and trial numbers will return on the next successful refresh.</p>
              <Button variant="secondary" className="mt-3" onClick={() => refetch()}>Retry</Button>
            </Card>
          )}

          <Card>
            <h3 className="text-sm font-semibold text-fg">Signups per week</h3>
            <div className="mt-4">
              <SignupsChart data={chartData} />
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-fg">Tier breakdown</h3>
            <div className="mt-4">
              <TierBar tiers={data.tiers} />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {USAGE.map(([key, label]) => (
              <StatTile key={key} label={label} value={data.usage[key].d7} sub={`${data.usage[key].d30} in 30d`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
