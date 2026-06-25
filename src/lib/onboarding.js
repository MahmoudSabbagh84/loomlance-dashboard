import { hasFeature, FEATURES } from '@/lib/tier'

// Ordered, business-first get-started tasks. Tier-aware: the logo task only appears for tiers
// that include custom branding. Pure — the component passes tier/counts/profile in.
export function onboardingTasks(tier, counts, profile) {
  const c = counts ?? {}
  const p = profile ?? {}
  const tasks = [
    { key: 'business', label: 'Set up your business profile', to: '/profile', done: !!p.business_name },
    { key: 'clients', label: 'Add your first client', to: '/clients', done: (c.clients ?? 0) > 0 },
    { key: 'projects', label: 'Create your first project', to: '/projects', done: (c.projects ?? 0) > 0 },
  ]
  if (hasFeature(tier, FEATURES.CUSTOM_BRANDING)) {
    tasks.push({ key: 'logo', label: 'Add your logo', to: '/profile?tab=branding', done: !!p.logo_url })
  }
  tasks.push({ key: 'invoice', label: 'Send your first invoice', to: '/invoices', done: (c.invoices ?? 0) > 0 })
  return tasks
}
