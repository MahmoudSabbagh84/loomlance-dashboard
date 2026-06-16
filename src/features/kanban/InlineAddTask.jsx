import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { positionBetween } from '@/api/tasks'
import { useCreateTask } from '@/hooks/useTasks'

export function InlineAddTask({ projectId, columnId, lastPosition }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const create = useCreateTask(projectId)

  const submit = async () => {
    const v = title.trim()
    if (!v) return
    try {
      await create.mutateAsync({
        project_id: projectId,
        column_id: columnId,
        title: v,
        position: positionBetween(lastPosition ?? null, null),
        priority: 'medium',
        labels: [],
      })
      setTitle('')
    } catch (e) {
      toast.error(e.userMessage || 'Failed to add task')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-fg-muted hover:bg-bg"
      >
        <Plus className="size-4" /> Add task
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          if (e.key === 'Escape') { setTitle(''); setOpen(false) }
        }}
        placeholder="Task title"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} loading={create.isPending}>Add</Button>
        <Button size="sm" variant="ghost" onClick={() => { setTitle(''); setOpen(false) }}>Cancel</Button>
      </div>
    </div>
  )
}
