import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Moon, Sun, ChevronDown, LogOut, UserCircle, CreditCard, Search } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useProfile } from '@/hooks/useProfile'
import { useSignOut } from '@/features/auth/useSignOut'
import { NotificationBell } from './NotificationBell'

export function Topbar() {
  const { theme, toggle } = useTheme()
  const { data: profile } = useProfile()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const initial = (profile?.display_name || profile?.email || '?').charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-1.5 border-b border-border bg-bg/80 px-6 backdrop-blur">
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('loomlance:open-search'))}
        className="flex h-9 items-center gap-2 rounded-md border border-border bg-bg-muted px-3 text-sm text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
        aria-label="Search"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden rounded border border-border px-1.5 text-[10px] sm:inline">⌘K</kbd>
      </button>
      <div className="flex items-center gap-1.5">
      <NotificationBell />
      <button
        onClick={toggle}
        className="grid size-9 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>
      <div className="relative ml-1" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-md pl-1 pr-2 transition-colors hover:bg-bg-muted"
        >
          <div className="grid size-7 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-fg">
            {initial}
          </div>
          <ChevronDown className="size-4 text-fg-muted" />
        </button>
        {open ? (
          <div className="animate-pop-in absolute right-0 mt-2 w-56 rounded-lg border border-border bg-bg-elevated py-1 shadow-lg">
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-sm font-medium">{profile?.display_name || 'User'}</p>
              <p className="truncate text-xs text-fg-muted">{profile?.email}</p>
            </div>
            <button
              onClick={() => { setOpen(false); navigate('/profile') }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-fg transition-colors hover:bg-bg-muted"
            >
              <UserCircle className="size-4" />
              Profile
            </button>
            <Link
              to="/profile?tab=subscription"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-fg transition-colors hover:bg-bg-muted"
            >
              <CreditCard className="size-4" />
              Subscription
            </Link>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-fg transition-colors hover:bg-bg-muted"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        ) : null}
      </div>
      </div>
    </header>
  )
}
