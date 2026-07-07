import { TriangleAlert } from 'lucide-react'
import { useAppConfig } from '@/hooks/useAppConfig'

// Site-wide maintenance notice. Renders nothing unless app_config.maintenance_banner has
// content — including while loading or on read failure (the banner must never block the app).
export function MaintenanceBanner() {
  const { data } = useAppConfig()
  const text = data?.maintenance_banner?.trim()
  if (!text) return null
  return (
    <div role="status" className="flex items-center gap-2.5 border-b border-warning/30 bg-warning/15 px-4 py-2 text-sm">
      <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <span className="text-fg">{text}</span>
    </div>
  )
}
