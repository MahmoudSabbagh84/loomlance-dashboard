import { useState } from 'react'
import { Plus, Star, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useClientContacts, useDeleteContact, useSetPrimaryContact } from '@/hooks/useClientContacts'
import { ContactFormModal } from '../ContactFormModal'

export function ContactsTab({ clientId }) {
  const { data: contacts = [], isLoading } = useClientContacts(clientId)
  const del = useDeleteContact(clientId)
  const setPrimary = useSetPrimaryContact(clientId)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  if (isLoading) return <p className="text-sm text-fg-muted">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}><Plus className="size-4" /> Add contact</Button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-fg-muted">No contacts yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-4 p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{c.name}</p>
                  {c.is_primary ? <Badge variant="primary"><Star className="size-3 inline -mt-0.5" /> Primary</Badge> : null}
                </div>
                <p className="text-xs text-fg-muted">
                  {[c.role, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              {!c.is_primary ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try { await setPrimary.mutateAsync(c.id); toast.success('Set as primary') }
                    catch (e) { toast.error(e.userMessage) }
                  }}
                  title="Make primary"
                >
                  <Star className="size-4" />
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Edit className="size-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c)}><Trash2 className="size-4 text-danger" /></Button>
            </li>
          ))}
        </ul>
      )}

      {creating ? <ContactFormModal open onClose={() => setCreating(false)} clientId={clientId} /> : null}
      {editing ? <ContactFormModal open onClose={() => setEditing(null)} clientId={clientId} contact={editing} /> : null}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete contact?"
        body={`Remove ${confirmDelete?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          try { await del.mutateAsync(confirmDelete.id); toast.success('Contact deleted'); setConfirmDelete(null) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={del.isPending}
      />
    </div>
  )
}
