import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCreateColumn } from '@/hooks/useKanbanColumns'

export function AddColumn({ projectId, position }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = useCreateColumn(projectId)

  const submit = async () => {
    const v = name.trim()
    if (!v) return
    try {
      await create.mutateAsync({ project_id: projectId, name: v, position })
      setName('')
      setOpen(false)
    } catch (e) {
      toast.error(e.userMessage || 'Failed to add column')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-72 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-dashed border-border px-3 py-3 text-sm text-fg-muted transition-colors hover:border-border-strong hover:bg-bg-elevated hover:text-fg"
      >
        <Plus className="size-4" /> Add column
      </button>
    )
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2 self-start rounded-lg border border-border bg-bg-elevated p-3">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          if (e.key === 'Escape') { setName(''); setOpen(false) }
        }}
        placeholder="Column name"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} loading={create.isPending}>Add column</Button>
        <Button size="sm" variant="ghost" onClick={() => { setName(''); setOpen(false) }} aria-label="Cancel">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
