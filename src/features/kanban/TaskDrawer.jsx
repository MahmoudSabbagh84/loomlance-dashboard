import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { taskUpdateSchema } from '@/api/schemas/tasks'
import { useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { useKanbanColumns } from '@/hooks/useKanbanColumns'

export function TaskDrawer({ open, onClose, projectId, task }) {
  const update = useUpdateTask(projectId)
  const del = useDeleteTask(projectId)
  const { data: columns = [] } = useKanbanColumns(projectId)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(taskUpdateSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      due_date: task?.due_date ?? '',
      priority: task?.priority ?? 'medium',
      column_id: task?.column_id ?? '',
    },
  })

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description ?? '',
        due_date: task.due_date ?? '',
        priority: task.priority,
        column_id: task.column_id,
      })
    }
  }, [task, reset])

  const onSubmit = async (values) => {
    try {
      const patch = { ...values, due_date: values.due_date || null }
      await update.mutateAsync({ id: task.id, patch })
      toast.success('Task updated')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Save failed')
    }
  }

  const onDelete = async () => {
    try {
      await del.mutateAsync(task.id)
      toast.success('Task deleted')
      setConfirmDelete(false)
      onClose()
    } catch (e) {
      toast.error(e.userMessage)
    }
  }

  if (!task) return null

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Task">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title" required>Title</Label>
            <Input id="title" {...register('title')} />
            <FieldError>{errors.title?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={6} {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" type="date" {...register('due_date')} />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" {...register('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="column_id">Column</Label>
            <Select id="column_id" {...register('column_id')}>
              {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="flex justify-between pt-4 border-t border-border">
            <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={isSubmitting}>Save</Button>
            </div>
          </div>
        </form>
      </Drawer>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete task?"
        body="This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={del.isPending}
      />
    </>
  )
}
