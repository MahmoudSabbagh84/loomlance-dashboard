import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { useProfile } from '@/hooks/useProfile'
import { onboardingTasks } from '@/lib/onboarding'

const DISMISS_KEY = 'loomlance.onboardingDismissed'

async function fetchCounts() {
  const [clients, projects, invoices] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).in('status', ['sent', 'viewed', 'paid']),
  ])
  for (const r of [clients, projects, invoices]) if (r.error) throw mapPostgresError(r.error)
  return {
    clients: clients.count ?? 0,
    projects: projects.count ?? 0,
    invoices: invoices.count ?? 0,
  }
}

export function OnboardingChecklist() {
  const { data: counts } = useQuery({ queryKey: ['dashboard', 'onboarding'], queryFn: fetchCounts, staleTime: 60_000 })
  const { data: profile } = useProfile()
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY) === 'true'
  )

  // Render nothing until both profile + counts have loaded.
  if (!counts || !profile) return null

  const tier = profile.subscription_tier ?? 'free'
  const items = onboardingTasks(tier, counts, profile)
  // Hide the whole card once the user dismisses it, or when every task is done.
  if (dismissed || items.every((i) => i.done)) return null

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      /* private mode — in-memory only */
    }
    setDismissed(true)
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="mb-4 flex items-start justify-between gap-3 rounded-md bg-primary/10 px-3 py-2.5">
        <p className="text-sm font-medium text-fg">
          Welcome to LoomLance 👋 Start by setting up your business profile.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss the get started checklist"
          className="shrink-0 rounded p-1 text-fg-muted transition-colors hover:bg-primary/15 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <X className="size-4" />
        </button>
      </div>
      <h3 className="mb-3 text-sm font-semibold">Get started with LoomLance</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key}>
            <Link to={i.to} className="flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-primary/10">
              {i.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : (
                <Circle className="size-4 shrink-0 text-fg-subtle" />
              )}
              <span className={i.done ? 'text-fg-muted line-through' : ''}>{i.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
