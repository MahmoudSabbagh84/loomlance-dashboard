import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

async function fetchCounts() {
  const [clients, projects, tasks, invoices] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).in('status', ['sent', 'viewed', 'paid']),
  ])
  for (const r of [clients, projects, tasks, invoices]) if (r.error) throw mapPostgresError(r.error)
  return {
    clients: clients.count ?? 0,
    projects: projects.count ?? 0,
    tasks: tasks.count ?? 0,
    invoices: invoices.count ?? 0,
  }
}

export function OnboardingChecklist() {
  const { data: counts } = useQuery({ queryKey: ['dashboard', 'onboarding'], queryFn: fetchCounts, staleTime: 60_000 })
  if (!counts) return null

  const items = [
    { done: counts.clients > 0, label: 'Add your first client', to: '/clients' },
    { done: counts.projects > 0, label: 'Create your first project', to: '/projects' },
    { done: counts.tasks > 0, label: 'Build a kanban board', to: '/projects' },
    { done: counts.invoices > 0, label: 'Send your first invoice', to: '/invoices' },
  ]
  if (items.every((i) => i.done)) return null

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <h3 className="mb-3 text-sm font-semibold">Get started with LoomLance</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.label}>
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
