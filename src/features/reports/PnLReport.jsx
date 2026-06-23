import { lazy, Suspense, useState } from 'react'
import { Download, Scale } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { cn } from '@/components/ui/cn'
import { CurrencyTabs } from './CurrencyTabs'
import { usePaymentsReport, useExpensesInRange } from '@/hooks/useReports'
import { useProfile } from '@/hooks/useProfile'
import { plReport, toCSV, reportFileName } from '@/lib/reports'
import { downloadTextFile } from '@/lib/download'
import { formatCurrency } from '@/lib/currency'

const ReportChart = lazy(() => import('./ReportChart'))

export function PnLReport({ range }) {
  const { data: payments = [], isLoading: lp } = usePaymentsReport(range)
  const { data: expenses = [], isLoading: le } = useExpensesInRange(range)
  const { data: profile } = useProfile()
  const [picked, setPicked] = useState(null)

  if (lp || le) return <Skeleton className="h-72" />

  const report = plReport(payments, expenses, range)
  if (report.currencies.length === 0) {
    return <EmptyState icon={Scale} title="No data in this range" description="Payments and expenses will show up here." />
  }

  const fallback = report.currencies.includes(profile?.default_currency) ? profile.default_currency : report.currencies[0]
  const currency = picked && report.currencies.includes(picked) ? picked : fallback
  const bucket = report.byCurrency[currency]
  const chartData = bucket.months.map((m) => ({ label: m.label, revenue: m.revenue, expense: m.expense }))

  const exportCsv = () => {
    const rows = bucket.months.map((m) => ({ month: m.label, revenue: m.revenue, expense: m.expense, net: m.net }))
    downloadTextFile(reportFileName('pnl', currency, range), toCSV(rows, [
      { key: 'month', label: 'Month' },
      { key: 'revenue', label: `Revenue (${currency})` },
      { key: 'expense', label: `Expense (${currency})` },
      { key: 'net', label: `Net (${currency})` },
    ]))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <CurrencyTabs currencies={report.currencies} value={currency} onChange={setPicked} />
        <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" /> CSV</Button>
      </div>
      <Card>
        <h3 className="mb-3 text-sm font-semibold">Revenue vs expense · {currency}</h3>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ReportChart
            data={chartData}
            bars={[
              { dataKey: 'revenue', name: 'Revenue', color: 'var(--color-primary)' },
              { dataKey: 'expense', name: 'Expense', color: 'var(--color-danger)' },
            ]}
            formatValue={(v) => formatCurrency(v, currency)}
          />
        </Suspense>
      </Card>
      <Card>
        <Table>
          <THead>
            <TR><TH>Month</TH><TH>Revenue</TH><TH>Expense</TH><TH>Net</TH></TR>
          </THead>
          <tbody>
            {bucket.months.map((m) => (
              <TR key={m.key}>
                <TD>{m.label}</TD>
                <TD className="tabular-nums">{formatCurrency(m.revenue, currency)}</TD>
                <TD className="tabular-nums">{formatCurrency(m.expense, currency)}</TD>
                <TD className={cn('tabular-nums font-medium', m.net >= 0 ? 'text-success' : 'text-danger')}>{formatCurrency(m.net, currency)}</TD>
              </TR>
            ))}
            <TR>
              <TD className="font-semibold">Total</TD>
              <TD className="tabular-nums font-semibold">{formatCurrency(bucket.totals.revenue, currency)}</TD>
              <TD className="tabular-nums font-semibold">{formatCurrency(bucket.totals.expense, currency)}</TD>
              <TD className={cn('tabular-nums font-semibold', bucket.totals.net >= 0 ? 'text-success' : 'text-danger')}>{formatCurrency(bucket.totals.net, currency)}</TD>
            </TR>
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
