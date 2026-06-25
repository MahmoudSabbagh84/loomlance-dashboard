import { describe, it, expect } from 'vitest'
import { onboardingTasks } from '@/lib/onboarding'

const emptyCounts = { clients: 0, projects: 0, invoices: 0 }
const emptyProfile = { business_name: '', logo_url: null }

describe('onboardingTasks', () => {
  it('always leads with the business profile task, first in order', () => {
    const tasks = onboardingTasks('free', emptyCounts, emptyProfile)
    expect(tasks[0]).toMatchObject({ key: 'business', to: '/profile', done: false })
    expect(tasks[0].label).toBe('Set up your business profile')
  })

  it('omits the logo task for tiers without custom branding (free)', () => {
    const keys = onboardingTasks('free', emptyCounts, emptyProfile).map((t) => t.key)
    expect(keys).toEqual(['business', 'clients', 'projects', 'invoice'])
  })

  it('includes the logo task for branding tiers, before the invoice task', () => {
    const keys = onboardingTasks('tier_1', emptyCounts, emptyProfile).map((t) => t.key)
    expect(keys).toEqual(['business', 'clients', 'projects', 'logo', 'invoice'])
    const logo = onboardingTasks('tier_1', emptyCounts, emptyProfile).find((t) => t.key === 'logo')
    expect(logo).toMatchObject({ to: '/profile?tab=branding', done: false })
  })

  it('marks done from counts and profile', () => {
    const tasks = onboardingTasks(
      'tier_2',
      { clients: 2, projects: 1, invoices: 3 },
      { business_name: 'Acme LLC', logo_url: 'https://x/y.png' }
    )
    const done = Object.fromEntries(tasks.map((t) => [t.key, t.done]))
    expect(done).toEqual({ business: true, clients: true, projects: true, logo: true, invoice: true })
  })

  it('treats missing counts/profile as not-done (no throw)', () => {
    const tasks = onboardingTasks('free', undefined, undefined)
    expect(tasks.every((t) => t.done === false)).toBe(true)
    expect(tasks[0].key).toBe('business')
  })
})
