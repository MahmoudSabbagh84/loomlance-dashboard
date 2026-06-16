import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Moon, Sun, ChevronDown, LogOut, UserCircle, CreditCard } from 'lucide-react'
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-3 border-b border-border bg-bg px-6">
      <NotificationBell />
      <button onClick={toggle} className="text-fg-muted hover:text-fg" aria-label="Toggle theme">
        {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-md p-1 hover:bg-bg-muted">
          <div className="size-8 rounded-full bg-primary text-primary-fg flex items-center justify-center text-sm font-semibold">
            {initial}
          </div>
          <ChevronDown className="size-4 text-fg-muted" />
        </button>
        {open ? (
          <div className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-bg shadow-lg py-1">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium truncate">{profile?.display_name || 'User'}</p>
              <p className="text-xs text-fg-muted truncate">{profile?.email}</p>
            </div>
            <button
              onClick={() => { setOpen(false); navigate('/profile') }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-bg-muted"
            >
              <UserCircle className="size-4" />
              Profile
            </button>
            <Link
              to="/profile?tab=subscription"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-bg-muted"
            >
              <CreditCard className="size-4" />
              Subscription
            </Link>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-bg-muted"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
