import { useState } from 'react'
import { Plus, Star, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useClientContacts, useDeleteContact, useSetPrimaryContact } from '@/hooks/useClientContacts'
import { ContactFormModal } from './ContactFormModal'

// People at a client (additional contacts beyond the client's own email/phone).
// Lives inside the client Overview so there's a single place for contact info.
export function PeopleCard({ clientId }) {
  const { data: contacts = [], isLoading } = useClientContacts(clientId)
  const del = useDeleteContact(clientId)
  const setPrimary = useSetPrimaryContact(clientId)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">People</h3>
        <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Add person
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-fg-muted">Loading…</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-fg-muted">No additional people yet. Add colleagues or billing contacts at this client.</p>
      ) : (
        <ul className="divide-y divide-border">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{c.name}</p>
                  {c.is_primary ? <Badge variant="primary"><Star className="-mt-0.5 inline size-3" /> Primary</Badge> : null}
                </div>
                <p className="truncate text-xs text-fg-muted">
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
                  aria-label={`Make ${c.name} the primary contact`}
                >
                  <Star className="size-4" />
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setEditing(c)} title="Edit" aria-label={`Edit ${c.name}`}><Edit className="size-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c)} title="Delete" aria-label={`Delete ${c.name}`}><Trash2 className="size-4 text-danger" /></Button>
            </li>
          ))}
        </ul>
      )}

      {creating ? <ContactFormModal open onClose={() => setCreating(false)} clientId={clientId} /> : null}
      {editing ? <ContactFormModal open onClose={() => setEditing(null)} clientId={clientId} contact={editing} /> : null}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete person?"
        body={`Remove ${confirmDelete?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          try { await del.mutateAsync(confirmDelete.id); toast.success('Person deleted'); setConfirmDelete(null) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={del.isPending}
      />
    </Card>
  )
}
