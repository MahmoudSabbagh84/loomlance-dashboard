import { lazy, Suspense, useState } from 'react'
import { Download, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { CurrencyTabs } from './CurrencyTabs'
import { useOpenInvoices } from '@/hooks/useReports'
import { useProfile } from '@/hooks/useProfile'
import { agingReport, toCSV } from '@/lib/reports'
import { downloadTextFile } from '@/lib/download'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'

const ReportChart = lazy(() => import('./ReportChart'))

const BUCKETS = [
  { key: 'current', label: 'Current' },
  { key: 'd1_30', label: '1–30' },
  { key: 'd31_60', label: '31–60' },
  { key: 'd61_90', label: '61–90' },
  { key: 'd90plus', label: '90+' },
]

export function AgingReport() {
  const { data: invoices = [], isLoading } = useOpenInvoices()
  const { data: profile } = useProfile()
  const [picked, setPicked] = useState(null)

  if (isLoading) return <Skeleton className="h-72" />

  const report = agingReport(invoices, new Date())
  if (report.currencies.length === 0) {
    return <EmptyState icon={Clock} title="No open invoices" description="Unpaid sent invoices will be aged here." />
  }

  const fallback = report.currencies.includes(profile?.default_currency) ? profile.default_currency : report.currencies[0]
  const currency = picked && report.currencies.includes(picked) ? picked : fallback
  const bucket = report.byCurrency[currency]
  const chartData = BUCKETS.map((b) => ({ label: b.label, amount: bucket.buckets[b.key] || 0 }))

  const exportCsv = () => {
    downloadTextFile(`aging-${currency}.csv`, toCSV(bucket.rows, [
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'client', label: 'Client' },
      { key: 'due_date', label: 'Due date' },
      { key: 'days_overdue', label: 'Days overdue' },
      { key: 'amount', label: `Amount (${currency})` },
      { key: 'bucket', label: 'Bucket' },
    ]))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <CurrencyTabs currencies={report.currencies} value={currency} onChange={setPicked} />
        <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" /> CSV</Button>
      </div>
      <Card>
        <h3 className="mb-3 text-sm font-semibold">Outstanding by age · {currency}</h3>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ReportChart data={chartData} bars={[{ dataKey: 'amount', name: 'Outstanding', color: 'var(--color-primary)' }]} formatValue={(v) => formatCurrency(v, currency)} />
        </Suspense>
      </Card>
      <Card>
        <Table>
          <THead>
            <TR><TH>Invoice</TH><TH>Client</TH><TH>Due</TH><TH>Days</TH><TH>Amount</TH></TR>
          </THead>
          <tbody>
            {bucket.rows.map((r) => (
              <TR key={r.invoice_number}>
                <TD>{r.invoice_number}</TD>
                <TD className="text-fg-muted">{r.client}</TD>
                <TD className="text-xs tabular-nums text-fg-muted">{formatDate(r.due_date)}</TD>
                <TD className="tabular-nums">{r.days_overdue}</TD>
                <TD className="tabular-nums">{formatCurrency(r.amount, currency)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
