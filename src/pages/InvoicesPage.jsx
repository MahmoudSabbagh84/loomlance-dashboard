import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/components/ui/cn'
import { useInvoices, useCreateInvoice, useNextInvoiceNumber } from '@/hooks/useInvoices'
import { useProfile } from '@/hooks/useProfile'
import { useClients } from '@/hooks/useClients'
import { InvoiceStatusBadge } from '@/features/invoices/InvoiceStatusBadge'
import { formatDate } from '@/lib/date'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { toast } from 'sonner'

const STATUSES = ['', 'draft', 'sent', 'viewed', 'paid', 'overdue', 'void']

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const debounced = useDebouncedValue(search, 250)
  const { data, isLoading } = useInvoices({ search: debounced, status: status || undefined, page, pageSize: 25 })
  const { data: profile } = useProfile()
  const { data: clientsPage } = useClients({ pageSize: 1 })

  const create = useCreateInvoice()
  const nextNum = useNextInvoiceNumber()

  const handleNew = async () => {
    if (!clientsPage?.rows?.length) {
      toast.error('Add a client first')
      return
    }
    try {
      const number = await nextNum.refetch().then((r) => r.data)
      const inv = await create.mutateAsync({
        client_id: clientsPage.rows[0].id,
        invoice_number: number,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        currency: profile?.default_currency || 'USD',
        line_items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0, position: 0 }],
      })
      navigate(`/invoices/${inv.id}`)
    } catch (e) {
      toast.error(e.userMessage || 'Could not create draft invoice')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Invoices" subtitle="Drafts, sent, paid, and overdue">
        <Button onClick={handleNew} loading={create.isPending}><Plus className="size-4" /> New invoice</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(0) }}
            className={cn(
              'h-8 rounded-full border px-3 text-xs font-medium capitalize transition-colors',
              status === s
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-fg-muted hover:bg-bg-muted hover:text-fg'
            )}
          >
            {s || 'all'}
          </button>
        ))}
      </div>

      <Input placeholder="Search by invoice number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="max-w-sm" />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : data?.rows.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Spin up your first draft." action={<Button onClick={handleNew}><Plus className="size-4" /> New invoice</Button>} />
      ) : (
        <>
          <Table>
            <THead><TR><TH>Number</TH><TH>Client</TH><TH>Issue</TH><TH>Due</TH><TH>Status</TH></TR></THead>
            <tbody>
              {data.rows.map((inv) => (
                <TR key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <TD className="font-medium tabular-nums">{inv.invoice_number}</TD>
                  <TD className="text-fg-muted">{inv.clients?.name}</TD>
                  <TD className="text-xs tabular-nums text-fg-muted">{formatDate(inv.issue_date)}</TD>
                  <TD className="text-xs tabular-nums text-fg-muted">{formatDate(inv.due_date)}</TD>
                  <TD><InvoiceStatusBadge status={inv.status} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={25} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}
