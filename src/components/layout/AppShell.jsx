import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 bg-bg">
          <div className="mx-auto max-w-7xl p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
