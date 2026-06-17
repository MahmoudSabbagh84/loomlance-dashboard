import { useState } from 'react'
import { Edit, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ClientFormModal } from './ClientFormModal'
import { useArchiveClient, useUnarchiveClient, useDeleteClient } from '@/hooks/useClients'

export function ClientHeader({ client }) {
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const archive = useArchiveClient()
  const unarchive = useUnarchiveClient()
  const del = useDeleteClient()

  const onArchive = async () => {
    try {
      if (client.archived_at) {
        await unarchive.mutateAsync(client.id)
        toast.success('Client unarchived')
      } else {
        await archive.mutateAsync(client.id)
        toast.success('Client archived')
      }
    } catch (e) {
      toast.error(e.userMessage)
    }
  }

  const onDelete = async () => {
    try {
      await del.mutateAsync(client.id)
      toast.success('Client deleted')
      navigate('/clients', { replace: true })
    } catch (e) {
      toast.error(e.userMessage)
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{client.name}</h1>
        {client.company ? <p className="text-sm text-fg-muted">{client.company}</p> : null}
        {(client.tags || []).length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {client.tags.map((t) => <Badge key={t}>{t}</Badge>)}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
          <Edit className="size-4" /> Edit
        </Button>
        <Button size="sm" variant="secondary" onClick={onArchive}>
          {client.archived_at ? <><ArchiveRestore className="size-4" /> Unarchive</> : <><Archive className="size-4" /> Archive</>}
        </Button>
        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
      {editOpen ? <ClientFormModal open onClose={() => setEditOpen(false)} client={client} /> : null}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete client?"
        body="This permanently removes the client. Their invoices and contracts will be orphaned. Consider archiving instead."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={del.isPending}
      />
    </div>
  )
}
