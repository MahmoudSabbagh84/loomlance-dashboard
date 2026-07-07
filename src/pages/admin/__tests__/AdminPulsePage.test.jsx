import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminPulsePage from '../AdminPulsePage'
import { useAdminMetrics } from '@/hooks/useAdminMetrics'

vi.mock('@/hooks/useAdminMetrics')
vi.mock('recharts', async (importOriginal) => {
  // jsdom has no layout; ResponsiveContainer renders nothing without dimensions.
  const mod = await importOriginal()
  return { ...mod, ResponsiveContainer: ({ children }) => <div data-testid="chart">{children}</div> }
})

const payload = {
  generatedAt: '2026-07-07T12:00:00Z',
  users: { total: 26, active7d: 9, active30d: 21, signupsByWeek: [{ weekStart: '2026-06-29', count: 3 }] },
  tiers: { free: 23, tier_1: 2, tier_2: 1, trialing: 1, pastDue: 0 },
  stripe: { mrr: 4800, currency: 'usd', activeSubs: 3, trialing: 1, trialsConverted: 2, trialsChurned: 1 },
  usage: {
    invoicesCreated: { d7: 4, d30: 12 }, invoicesSent: { d7: 2, d30: 9 },
    projectsCreated: { d7: 1, d30: 5 }, hoursTracked: { d7: 14.5, d30: 61 }, clientsAdded: { d7: 0, d30: 3 },
  },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminPulsePage />
    </MemoryRouter>
  )
}

describe('AdminPulsePage', () => {
  it('renders user, revenue, and usage numbers', () => {
    useAdminMetrics.mockReturnValue({ data: payload, isLoading: false, isError: false, refetch: vi.fn(), dataUpdatedAt: Date.now() })
    renderPage()
    expect(screen.getByText('Total users')).toBeInTheDocument()
    expect(screen.getByText('26')).toBeInTheDocument()
    expect(screen.getByText('MRR')).toBeInTheDocument()
    expect(screen.getByText('$48.00')).toBeInTheDocument()
    expect(screen.getByText('Invoices created')).toBeInTheDocument()
  })
  it('degrades the revenue row when stripe is null, keeping DB tiles', () => {
    useAdminMetrics.mockReturnValue({
      data: { ...payload, stripe: null, stripeError: true },
      isLoading: false, isError: false, refetch: vi.fn(), dataUpdatedAt: Date.now(),
    })
    renderPage()
    expect(screen.getByText(/Stripe unavailable/)).toBeInTheDocument()
    expect(screen.queryByText('MRR')).not.toBeInTheDocument()
    expect(screen.getByText('Total users')).toBeInTheDocument()
  })
  it('shows an error state with retry on hard failure', () => {
    useAdminMetrics.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn(), dataUpdatedAt: 0 })
    renderPage()
    expect(screen.getByText(/Couldn.t load metrics/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
