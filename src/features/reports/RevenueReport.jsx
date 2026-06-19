import { lazy, Suspense, useState } from 'react'
import { Download, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { CurrencyTabs } from './CurrencyTabs'
import { usePaymentsReport } from '@/hooks/useReports'
import { useProfile } from '@/hooks/useProfile'
import { revenueReport, toCSV } from '@/lib/reports'
import { downloadTextFile } from '@/lib/download'
import { formatCurrency } from '@/lib/currency'

const ReportChart = lazy(() => import('./ReportChart'))

function BreakdownTable({ rows, total, currency }) {
  return (
    <Table>
      <THead>
        <TR><TH>Name</TH><TH>Total</TH><TH>%</TH></TR>
      </THead>
      <tbody>
        {rows.map((r) => (
          <TR key={r.name}>
            <TD>{r.name}</TD>
            <TD className="tabular-nums">{formatCurrency(r.total, currency)}</TD>
            <TD className="tabular-nums text-fg-muted">{total ? Math.round((r.total / total) * 100) : 0}%</TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}

export function RevenueReport({ range }) {
  const { data: payments = [], isLoading } = usePaymentsReport(range)
  const { data: profile } = useProfile()
  const [picked, setPicked] = useState(null)

  if (isLoading) return <Skeleton className="h-72" />

  const report = revenueReport(payments, range)
  if (report.currencies.length === 0) {
    return <EmptyState icon={TrendingUp} title="No revenue in this range" description="Payments you receive will show up here." />
  }

  const fallback = report.currencies.includes(profile?.default_currency) ? profile.default_currency : report.currencies[0]
  const currency = picked && report.currencies.includes(picked) ? picked : fallback
  const bucket = report.byCurrency[currency]
  const chartData = report.months.map((m) => ({ label: m.label, revenue: bucket.monthTotals[m.key] || 0 }))

  const exportCsv = () => {
    const rows = report.months.map((m) => ({ month: m.label, revenue: bucket.monthTotals[m.key] || 0 }))
    downloadTextFile(`revenue-${currency}.csv`, toCSV(rows, [{ key: 'month', label: 'Month' }, { key: 'revenue', label: `Revenue (${currency})` }]))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <CurrencyTabs currencies={report.currencies} value={currency} onChange={setPicked} />
        <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" /> CSV</Button>
      </div>
      <Card>
        <h3 className="mb-3 text-sm font-semibold">Revenue by month · {currency}</h3>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ReportChart data={chartData} bars={[{ dataKey: 'revenue', name: 'Revenue', color: 'var(--color-primary)' }]} formatValue={(v) => formatCurrency(v, currency)} />
        </Suspense>
      </Card>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">By client</h3>
          <BreakdownTable rows={bucket.byClient} total={bucket.total} currency={currency} />
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold">By project</h3>
          <BreakdownTable rows={bucket.byProject} total={bucket.total} currency={currency} />
        </Card>
      </div>
    </div>
  )
}
