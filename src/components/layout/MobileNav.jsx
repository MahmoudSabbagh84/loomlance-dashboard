import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { SidebarNav } from './SidebarNav'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Close on route change.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="grid size-9 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
              <div className="animate-slide-in-left absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-bg-elevated shadow-2xl">
                <div className="flex h-16 items-center justify-between border-b border-border px-4">
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="" className="size-9" />
                    <span className="text-base font-semibold tracking-tight">
                      <span className="text-primary">Loom</span>
                      <span className="text-fg-muted">Lance</span>
                    </span>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="text-fg-subtle transition-colors hover:text-fg"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <SidebarNav onNavigate={() => setOpen(false)} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
