import { lazy, Suspense } from 'react'
import { Download, Timer } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { useTimeEntriesInRange } from '@/hooks/useReports'
import { useProfile } from '@/hooks/useProfile'
import { timeReport, toCSV, reportFileName } from '@/lib/reports'
import { downloadTextFile } from '@/lib/download'
import { formatCurrency } from '@/lib/currency'

const ReportChart = lazy(() => import('./ReportChart'))

export function TimeReport({ range }) {
  const { data: entries = [], isLoading } = useTimeEntriesInRange(range)
  const { data: profile } = useProfile()
  const currency = profile?.default_currency || 'USD'

  if (isLoading) return <Skeleton className="h-72" />

  const report = timeReport(entries)
  if (report.byProject.length === 0) {
    return <EmptyState icon={Timer} title="No time in this range" description="Completed time entries will show up here." />
  }

  const chartData = report.byProject.map((p) => ({ label: p.project, billableHours: p.billableHours, nonBillableHours: p.nonBillableHours }))

  const exportCsv = () => {
    downloadTextFile(reportFileName('time', currency, range), toCSV(report.byProject, [
      { key: 'project', label: 'Project' },
      { key: 'billableHours', label: 'Billable hours' },
      { key: 'nonBillableHours', label: 'Non-billable hours' },
      { key: 'totalHours', label: 'Total hours' },
      { key: 'amount', label: `Billable amount (${currency})` },
    ]))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" /> CSV</Button>
      </div>
      <Card>
        <h3 className="mb-3 text-sm font-semibold">Hours by project</h3>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ReportChart
            data={chartData}
            bars={[
              { dataKey: 'billableHours', name: 'Billable', color: 'var(--color-primary)' },
              { dataKey: 'nonBillableHours', name: 'Non-billable', color: 'var(--color-fg-subtle)' },
            ]}
            formatValue={(v, name) => `${v}h ${name}`}
          />
        </Suspense>
      </Card>
      <Card>
        <Table>
          <THead>
            <TR><TH>Project</TH><TH>Billable</TH><TH>Non-billable</TH><TH>Total</TH><TH>Amount</TH></TR>
          </THead>
          <tbody>
            {report.byProject.map((p) => (
              <TR key={p.project}>
                <TD>{p.project}</TD>
                <TD className="tabular-nums">{p.billableHours}h</TD>
                <TD className="tabular-nums text-fg-muted">{p.nonBillableHours}h</TD>
                <TD className="tabular-nums">{p.totalHours}h</TD>
                <TD className="tabular-nums">{formatCurrency(p.amount, currency)}</TD>
              </TR>
            ))}
            <TR>
              <TD className="font-semibold">Total</TD>
              <TD className="tabular-nums font-semibold">{report.totals.billableHours}h</TD>
              <TD className="tabular-nums font-semibold text-fg-muted">{report.totals.nonBillableHours}h</TD>
              <TD className="tabular-nums font-semibold">{report.totals.totalHours}h</TD>
              <TD className="tabular-nums font-semibold">{formatCurrency(report.totals.amount, currency)}</TD>
            </TR>
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
