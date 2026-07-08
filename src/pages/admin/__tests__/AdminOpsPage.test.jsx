// src/pages/admin/__tests__/AdminOpsPage.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminOpsPage from '../AdminOpsPage'
import { useAdminOps } from '@/hooks/useAdminOps'

vi.mock('@/hooks/useAdminOps')

const fullData = {
  generatedAt: '2026-07-08T14:00:00Z',
  cron: [
    { jobname: 'mark-overdue-invoices', schedule: '0 6 * * *', lastRunAt: '2026-07-08T06:00:00Z', lastStatus: 'succeeded', lastMessage: '1 row', failures7d: 0 },
    { jobname: 'generate-recurring-invoices', schedule: '30 6 * * *', lastRunAt: '2026-07-08T06:30:00Z', lastStatus: 'failed', lastMessage: 'boom', failures7d: 3 },
  ],
  stripe: {
    lastByType: [{ type: 'checkout.session.completed', processedAt: '2026-06-24T18:53:39Z' }],
    failures: [{ id: 'e1', message: 'webhook ledger error', context: { source: 'stripe-webhook', eventType: 'checkout.session.completed' }, created_at: '2026-07-08T12:00:00Z', user_id: null }],
  },
  emailFailures: [{ id: 'e2', message: 'Email send failed: SES 502', context: { source: 'send-invoice', invoiceId: 'inv1' }, created_at: '2026-07-08T11:00:00Z', user_id: null }],
  clientErrors: [{ id: 'e3', message: 'TypeError: x is undefined', context: { type: 'window.onerror' }, created_at: '2026-07-08T10:00:00Z', user_id: null }],
}

const emptyData = {
  generatedAt: '2026-07-08T14:00:00Z',
  cron: fullData.cron,
  stripe: { lastByType: [], failures: [] },
  emailFailures: [],
  clientErrors: [],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/ops']}>
      <AdminOpsPage />
    </MemoryRouter>
  )
}

describe('AdminOpsPage', () => {
  it('renders all four feeds with data', () => {
    useAdminOps.mockReturnValue({ data: fullData, isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('mark-overdue-invoices')).toBeInTheDocument()
    expect(screen.getByText('succeeded')).toBeInTheDocument()
    expect(screen.getByText(/3 failed/)).toBeInTheDocument()
    expect(screen.getByText('checkout.session.completed')).toBeInTheDocument()
    expect(screen.getByText(/Email send failed: SES 502/)).toBeInTheDocument()
    expect(screen.getByText(/TypeError: x is undefined/)).toBeInTheDocument()
  })
  it('shows empty states when nothing is wrong', () => {
    useAdminOps.mockReturnValue({ data: emptyData, isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()
    // Cron still renders rows; the three error feeds show the good-outcome empty text.
    expect(screen.getByText('mark-overdue-invoices')).toBeInTheDocument()
    expect(screen.getByText(/No events recorded yet/)).toBeInTheDocument()
    expect(screen.getAllByText(/Nothing to report/).length).toBeGreaterThanOrEqual(2)
  })
  it('shows an error state with retry on failure', () => {
    useAdminOps.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText(/Couldn.t load ops data/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
