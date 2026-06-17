import { Bell } from 'lucide-react'

export function NotificationBell() {
  return (
    <button
      className="relative grid size-9 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
      aria-label="Notifications"
    >
      <Bell className="size-5" />
    </button>
  )
}
