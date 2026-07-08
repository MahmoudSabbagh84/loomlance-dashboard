import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useSaveVaultCredential, useUpdateVaultMetadata } from '@/hooks/useVault'
import { useProjects } from '@/hooks/useProjects'

const TYPES = [
  ['api_key', 'API key'],
  ['login', 'Login'],
  ['database_url', 'Database URL'],
  ['env', '.env'],
  ['ssh_key', 'SSH key'],
  ['note', 'Note'],
]

const selectClass = 'h-10 w-full rounded-md border border-border bg-bg px-3 text-sm'

export function VaultEntryModal({ open, entry, onClose }) {
  const isEdit = !!entry?.id
  const save = useSaveVaultCredential()
  const updateMeta = useUpdateVaultMetadata()
  const { data: projects } = useProjects()
  const [form, setForm] = useState({
    label: entry?.label ?? '',
    type: entry?.type ?? 'api_key',
    username: entry?.username ?? '',
    url: entry?.url ?? '',
    notes: entry?.notes ?? '',
    project_id: entry?.project_id ?? '',
    secret: '',
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const busy = save.isPending || updateMeta.isPending

  const submit = async () => {
    if (!form.label.trim()) return toast.error('A label is required')
    const meta = {
      label: form.label.trim(),
      type: form.type,
      username: form.username.trim() || null,
      url: form.url.trim() || null,
      notes: form.notes.trim() || null,
      project_id: form.project_id || null,
    }
    try {
      if (isEdit && !form.secret) {
        // Metadata-only edit — no decrypt needed.
        await updateMeta.mutateAsync({ id: entry.id, patch: meta })
      } else {
        if (!isEdit && !form.secret) return toast.error('A secret value is required')
        await save.mutateAsync({ ...(isEdit ? { id: entry.id } : {}), ...meta, secret: form.secret })
      }
      toast.success(isEdit ? 'Credential updated' : 'Credential saved')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || e.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit credential' : 'New credential'}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="v-label" required>Label</Label>
          <Input id="v-label" value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Acme Stripe live key" />
        </div>
        <div>
          <Label htmlFor="v-type">Type</Label>
          <select id="v-type" className={selectClass} value={form.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="v-secret" required={!isEdit}>Secret</Label>
          <Textarea id="v-secret" rows={4} value={form.secret} onChange={(e) => set('secret', e.target.value)}
            placeholder={isEdit ? 'Leave blank to keep the current secret' : 'Paste the key, token, connection string, or .env'} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="v-username">Username / identifier</Label>
            <Input id="v-username" value={form.username} onChange={(e) => set('username', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="v-url">URL</Label>
            <Input id="v-url" value={form.url} onChange={(e) => set('url', e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="v-project">Project</Label>
          <select id="v-project" className={selectClass} value={form.project_id} onChange={(e) => set('project_id', e.target.value)}>
            <option value="">No project</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="v-notes">Notes</Label>
          <Textarea id="v-notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={submit}>{isEdit ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  )
}
