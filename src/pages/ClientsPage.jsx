import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useClients } from '@/hooks/useClients'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { ClientFormModal } from '@/features/clients/ClientFormModal'

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const debouncedSearch = useDebouncedValue(search, 250)
  const [formOpen, setFormOpen] = useState(false)
  const pageSize = 25

  const { data, isLoading } = useClients({ search: debouncedSearch, page, pageSize })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-fg-muted">Manage your client relationships</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="size-4" />
          New client
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <Input
          placeholder="Search by name, company, or email"
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : data?.rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client to start tracking projects and invoices."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> New client</Button>}
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Company</TH>
                <TH>Email</TH>
                <TH>Tags</TH>
              </TR>
            </THead>
            <tbody>
              {data.rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link to={`/clients/${c.id}`} className="font-medium text-fg hover:text-primary">
                      {c.name}
                    </Link>
                  </TD>
                  <TD className="text-fg-muted">{c.company || '—'}</TD>
                  <TD className="text-fg-muted">{c.email || '—'}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map((t) => <Badge key={t}>{t}</Badge>)}
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={data.total} onChange={setPage} />
        </>
      )}

      {formOpen ? <ClientFormModal open onClose={() => setFormOpen(false)} /> : null}
    </div>
  )
}
