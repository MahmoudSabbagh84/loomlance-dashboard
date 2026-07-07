import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MaintenanceBanner } from './MaintenanceBanner'
import { CommandPalette } from '@/features/search/CommandPalette'
import { TrialBootstrap } from '@/features/subscription/TrialBootstrap'

export function AppShell({ children }) {
  return (
    <div className="flex min-h-screen">
      <CommandPalette />
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <MaintenanceBanner />
        <Topbar />
        <main className="relative flex-1 bg-bg">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-0 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_12%,transparent),transparent)] dark:opacity-100" />
          <div className="relative mx-auto max-w-7xl px-6 py-5">
            <TrialBootstrap />
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
