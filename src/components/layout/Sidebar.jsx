import { SidebarNav } from './SidebarNav'

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-bg-elevated lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <img src="/logo.png" alt="" className="size-10" />
        <span className="text-base font-semibold tracking-tight">
          <span className="text-primary">Loom</span>
          <span className="text-fg-muted">Lance</span>
        </span>
      </div>
      <SidebarNav />
    </aside>
  )
}
