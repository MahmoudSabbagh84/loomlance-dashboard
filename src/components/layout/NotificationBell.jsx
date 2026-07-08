import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { relativeTime } from '@/lib/date'
import { cn } from '@/components/ui/cn'
import { useNotifications, useUnreadCount, useMarkAllRead, useMarkRead } from '@/hooks/useNotifications'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { data: count = 0 } = useUnreadCount()
  const { data: notes = [] } = useNotifications({ limit: 10 })
  const markAll = useMarkAllRead()
  const markRead = useMarkRead()

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative grid size-9 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="size-5" />
        {count > 0 ? (
          <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-medium tabular-nums text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="animate-pop-in absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-lg">
          <div className="flex items-center justify-between border-b border-border p-3">
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 ? <button className="text-xs text-primary hover:underline" onClick={() => markAll.mutate()}>Mark all read</button> : null}
          </div>
          {notes.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">You’re all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {notes.map((n) => {
                const rowContent = (
                  <>
                    <p>{n.payload?.title || n.kind}</p>
                    {n.payload?.body ? <p className="text-xs text-fg-muted">{n.payload.body}</p> : null}
                    <p className="mt-1 text-[10px] text-fg-subtle">{relativeTime(n.created_at)}</p>
                  </>
                )
                const onRowClick = () => { if (!n.read_at) markRead.mutate(n.id); setOpen(false) }
                const rowClass = 'block p-3 text-sm hover:bg-bg-muted'
                // Announcements link out to the public blog — a router Link can't navigate to
                // absolute URLs, so external targets get a real anchor in a new tab.
                const external = n.link_to?.startsWith('http')
                return (
                  <li key={n.id} className={cn('transition-colors', !n.read_at && 'bg-bg-muted/50')}>
                    {external ? (
                      <a href={n.link_to} target="_blank" rel="noopener noreferrer" onClick={onRowClick} className={rowClass}>
                        {rowContent}
                      </a>
                    ) : (
                      <Link to={n.link_to || '#'} onClick={onRowClick} className={rowClass}>
                        {rowContent}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
