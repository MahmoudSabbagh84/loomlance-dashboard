import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toolbar } from '@/components/ui/Toolbar'
import { useContracts } from '@/hooks/useContracts'
import { ContractStatusBadge } from '@/features/contracts/ContractStatusBadge'
import { ContractFormModal } from '@/features/contracts/ContractFormModal'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

export default function ContractsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const debounced = useDebouncedValue(search, 250)
  const { data, isLoading } = useContracts({ search: debounced, status: status || undefined, page, pageSize: 25 })

  return (
    <div className="space-y-5">
      <PageHeader title="Contracts" subtitle="Track agreements and signed PDFs">
        <Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> New contract</Button>
      </PageHeader>

      <Toolbar>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} className="w-40">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="expired">Expired</option>
          <option value="canceled">Canceled</option>
        </Select>
        <Input placeholder="Search contracts" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="max-w-xs" />
      </Toolbar>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : data?.rows.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No contracts yet"
          description="Track agreements and upload signed PDFs."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> New contract</Button>}
        />
      ) : (
        <>
          <Table>
            <THead><TR><TH>Title</TH><TH>Client</TH><TH>Value</TH><TH>Dates</TH><TH>Status</TH></TR></THead>
            <tbody>
              {data.rows.map((c) => (
                <TR key={c.id}>
                  <TD><Link to={`/contracts/${c.id}`} className="font-medium hover:text-primary">{c.title}</Link></TD>
                  <TD className="text-fg-muted">{c.clients?.name}</TD>
                  <TD className="tabular-nums">{c.value != null ? formatCurrency(c.value, c.currency) : '—'}</TD>
                  <TD className="text-xs tabular-nums text-fg-muted">
                    {c.start_date ? formatDate(c.start_date) : '—'} → {c.end_date ? formatDate(c.end_date) : '—'}
                  </TD>
                  <TD><ContractStatusBadge status={c.status} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={25} total={data.total} onChange={setPage} />
        </>
      )}

      {formOpen ? <ContractFormModal open onClose={() => setFormOpen(false)} /> : null}
    </div>
  )
}
