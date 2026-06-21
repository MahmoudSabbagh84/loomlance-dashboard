import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Search, Users, Pencil, Mail, Trash2 } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useClients, useDeleteClient } from '@/hooks/useClients'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toolbar } from '@/components/ui/Toolbar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ClientFormModal } from '@/features/clients/ClientFormModal'

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const debouncedSearch = useDebouncedValue(search, 250)
  const [formOpen, setFormOpen] = useState(false)
  const [editClient, setEditClient] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const pageSize = 25

  const { data, isLoading } = useClients({ search: debouncedSearch, page, pageSize })
  const del = useDeleteClient()

  const onDelete = async () => {
    try {
      await del.mutateAsync(deleteTarget.id)
      toast.success('Client deleted')
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e.userMessage || 'Could not delete client')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Clients" subtitle="Manage your client relationships">
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="size-4" />
          New client
        </Button>
      </PageHeader>

      <Toolbar>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            placeholder="Search by name, company, or email"
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
      </Toolbar>

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
                <TH></TH>
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
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditClient(c)}
                        className="grid size-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-bg-muted hover:text-fg"
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil className="size-4" />
                      </button>
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="grid size-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-bg-muted hover:text-fg"
                          aria-label={`Email ${c.name}`}
                        >
                          <Mail className="size-4" />
                        </a>
                      ) : null}
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="grid size-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
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
      {editClient ? (
        <ClientFormModal open onClose={() => setEditClient(null)} client={editClient} />
      ) : null}
      {deleteTarget ? (
        <ConfirmDialog
          open
          title="Delete client?"
          body={`Delete ${deleteTarget.name}? This can't be undone.`}
          confirmLabel="Delete"
          variant="danger"
          loading={del.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  )
}
