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
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        {client.company ? <p className="text-fg-muted">{client.company}</p> : null}
        {(client.tags || []).length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {client.tags.map((t) => <Badge key={t}>{t}</Badge>)}
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setEditOpen(true)}>
          <Edit className="size-4" /> Edit
        </Button>
        <Button variant="secondary" onClick={onArchive}>
          {client.archived_at ? <><ArchiveRestore className="size-4" /> Unarchive</> : <><Archive className="size-4" /> Archive</>}
        </Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
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
