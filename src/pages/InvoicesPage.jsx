import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, List, LayoutGrid, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/components/ui/cn'
import { useInvoices } from '@/hooks/useInvoices'
import { useProfile } from '@/hooks/useProfile'
import { useClients } from '@/hooks/useClients'
import { InvoiceStatusBadge } from '@/features/invoices/InvoiceStatusBadge'
import { InvoicesBoard } from '@/features/invoices/InvoicesBoard'
import { NewInvoiceModal } from '@/features/invoices/NewInvoiceModal'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'
import { invoiceTotals } from '@/lib/money'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { toast } from 'sonner'

const STATUSES = ['', 'draft', 'sent', 'viewed', 'paid', 'overdue', 'void']

function readView() {
  try {
    return localStorage.getItem('invoices-view') || 'table'
  } catch {
    return 'table'
  }
}

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [view, setView] = useState(readView)
  const isBoard = view === 'board'
  const debounced = useDebouncedValue(search, 250)
  const { data, isLoading } = useInvoices({
    search: debounced,
    status: isBoard ? undefined : status || undefined,
    page: isBoard ? 0 : page,
    pageSize: isBoard ? 200 : 25,
  })
  const { data: profile } = useProfile()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const [newOpen, setNewOpen] = useState(false)

  const setViewPersist = (v) => {
    setView(v)
    try {
      localStorage.setItem('invoices-view', v)
    } catch {
      /* private mode: in-memory only */
    }
  }

  const handleNew = () => {
    if (!clients.length) {
      toast.error('Add a client first')
      return
    }
    setNewOpen(true)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Invoices" subtitle="Drafts, sent, paid, and overdue">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/invoices/recurring')}><Repeat className="size-4" /> Recurring</Button>
          <Button onClick={handleNew}><Plus className="size-4" /> New invoice</Button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {!isBoard &&
            STATUSES.map((s) => (
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

        <div className="flex items-center gap-2">
          <Input placeholder="Search by invoice number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="w-56" />
          <div className="flex shrink-0 items-center rounded-md border border-border p-0.5">
            {[
              { key: 'table', icon: List, label: 'Table view' },
              { key: 'board', icon: LayoutGrid, label: 'Board view' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                onClick={() => setViewPersist(key)}
                className={cn(
                  'grid size-8 place-items-center rounded transition-colors',
                  view === key ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:text-fg'
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : data?.rows.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Spin up your first draft." action={<Button onClick={handleNew}><Plus className="size-4" /> New invoice</Button>} />
      ) : isBoard ? (
        <InvoicesBoard invoices={data.rows} onOpen={(id) => navigate(`/invoices/${id}`)} />
      ) : (
        <>
          <Table>
            <THead><TR><TH>Number</TH><TH>Client</TH><TH>Issue</TH><TH>Due</TH><TH>Status</TH><TH className="text-right">Total</TH></TR></THead>
            <tbody>
              {data.rows.map((inv) => (
                <TR key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <TD className="font-medium tabular-nums">{inv.invoice_number}</TD>
                  <TD className="text-fg-muted">{inv.clients?.name}</TD>
                  <TD className="text-xs tabular-nums text-fg-muted">{formatDate(inv.issue_date)}</TD>
                  <TD className="text-xs tabular-nums text-fg-muted">{formatDate(inv.due_date)}</TD>
                  <TD><InvoiceStatusBadge status={inv.status} /></TD>
                  <TD className="text-right font-medium tabular-nums">{formatCurrency(invoiceTotals(inv.invoice_line_items || []).total, inv.currency)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={25} total={data.total} onChange={setPage} />
        </>
      )}

      <NewInvoiceModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        clients={clients}
        profile={profile}
        onCreated={(id) => {
          setNewOpen(false)
          navigate(`/invoices/${id}`)
        }}
      />
    </div>
  )
}
