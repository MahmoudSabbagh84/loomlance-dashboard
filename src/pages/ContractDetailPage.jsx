import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useContract, useDeleteContract } from '@/hooks/useContracts'
import { Skeleton } from '@/components/ui/Skeleton'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ContractFormModal } from '@/features/contracts/ContractFormModal'
import { ContractStatusBadge } from '@/features/contracts/ContractStatusBadge'
import { ContractPdfUploader } from '@/features/contracts/ContractPdfUploader'
import { ContractSignaturePanel } from '@/features/contracts/ContractSignaturePanel'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'

export default function ContractDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: contract, isLoading, error } = useContract(id)
  const del = useDeleteContract()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) return <Skeleton className="h-32" />
  if (error || !contract) return <p>Contract not found. <button onClick={() => navigate('/contracts')} className="text-primary underline">Back</button></p>

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Contracts', to: '/contracts' }, { label: contract.title }]} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold tracking-tight">{contract.title}</h1>
            <ContractStatusBadge status={contract.status} />
          </div>
          <p className="text-sm text-fg-muted">{contract.clients?.name}{contract.projects ? ` · ${contract.projects.name}` : ''}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}><Edit className="size-4" /> Edit</Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /> Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Details</h3>
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-fg-muted">Value: </dt><dd className="inline tabular-nums">{contract.value != null ? formatCurrency(contract.value, contract.currency) : '—'}</dd></div>
            <div><dt className="inline text-fg-muted">Starts: </dt><dd className="inline">{contract.start_date ? formatDate(contract.start_date) : '—'}</dd></div>
            <div><dt className="inline text-fg-muted">Ends: </dt><dd className="inline">{contract.end_date ? formatDate(contract.end_date) : '—'}</dd></div>
          </dl>
          {contract.description ? (
            <div className="mt-3">
              <h4 className="mb-1 text-xs font-semibold uppercase text-fg-muted">Description</h4>
              <p className="whitespace-pre-line text-sm">{contract.description}</p>
            </div>
          ) : null}
        </Card>
        <ContractPdfUploader contract={contract} />
        <div className="md:col-span-2">
          <ContractSignaturePanel contract={contract} />
        </div>
      </div>

      {editOpen ? <ContractFormModal open onClose={() => setEditOpen(false)} contract={contract} /> : null}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete contract?"
        body="This cannot be undone. Uploaded PDFs will be orphaned."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try { await del.mutateAsync(contract.id); toast.success('Contract deleted'); navigate('/contracts', { replace: true }) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={del.isPending}
      />
    </div>
  )
}
