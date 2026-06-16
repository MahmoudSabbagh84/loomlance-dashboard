import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Trash2, Pencil, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/components/ui/cn'
import { useDeleteColumn, useUpdateColumn } from '@/hooks/useKanbanColumns'
import { useArchiveDoneInColumn } from '@/hooks/useTasks'

export function ColumnSettingsMenu({ projectId, column, tasksInColumn }) {
  const [open, setOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const update = useUpdateColumn(projectId)
  const del = useDeleteColumn(projectId)
  const clear = useArchiveDoneInColumn(projectId)
  const [name, setName] = useState(column.name)
  const [wip, setWip] = useState(column.wip_limit ?? '')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items = [
    { icon: Pencil, label: 'Rename / WIP', onClick: () => { setRenameOpen(true); setOpen(false) } },
    { icon: CheckCheck, label: 'Clear cards', onClick: () => { setConfirmClear(true); setOpen(false) } },
    { icon: Trash2, label: 'Delete column', danger: true, onClick: () => { setConfirmDelete(true); setOpen(false) } },
  ]

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Column menu"
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            'rounded-md p-1 text-fg-subtle transition-colors hover:bg-bg-muted hover:text-fg',
            open && 'bg-bg-muted text-fg'
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
        {open ? (
          <div
            role="menu"
            className="animate-pop-in absolute right-0 z-30 mt-1 w-48 origin-top-right rounded-lg border border-border bg-bg p-1 shadow-lg"
          >
            {items.map((it) => (
              <button
                key={it.label}
                role="menuitem"
                onClick={it.onClick}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-bg-muted',
                  it.danger ? 'text-danger' : 'text-fg'
                )}
              >
                <it.icon className="size-4" />
                {it.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Column settings" size="sm">
        <div className="space-y-4">
          <div>
            <Label htmlFor="cname">Name</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="cwip">WIP limit</Label>
            <Input
              id="cwip"
              type="number"
              min={1}
              value={wip}
              onChange={(e) => setWip(e.target.value)}
              placeholder="No limit"
            />
            <p className="mt-1 text-xs text-fg-subtle">Cards beyond this turn the count red. Leave blank for no limit.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  await update.mutateAsync({ id: column.id, patch: { name, wip_limit: wip === '' ? null : Number(wip) } })
                  toast.success('Column updated')
                  setRenameOpen(false)
                } catch (e) { toast.error(e.userMessage) }
              }}
              loading={update.isPending}
            >Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete column?"
        body={`This permanently deletes the column and all ${tasksInColumn} task${tasksInColumn === 1 ? '' : 's'} in it.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try { await del.mutateAsync(column.id); toast.success('Column deleted'); setConfirmDelete(false) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={del.isPending}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear all cards?"
        body="Cards in this column will be archived (not deleted) and disappear from the board."
        confirmLabel="Clear"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          try { await clear.mutateAsync(column.id); toast.success('Column cleared'); setConfirmClear(false) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={clear.isPending}
      />
    </>
  )
}
