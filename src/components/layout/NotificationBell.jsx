import { Bell } from 'lucide-react'

export function NotificationBell() {
  return (
    <button className="relative text-fg-muted hover:text-fg" aria-label="Notifications">
      <Bell className="size-5" />
    </button>
  )
}
