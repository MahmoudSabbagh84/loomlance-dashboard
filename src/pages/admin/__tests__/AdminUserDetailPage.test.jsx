// src/pages/admin/__tests__/AdminUserDetailPage.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminUserDetailPage from '../AdminUserDetailPage'
import { useAdminUserDetail, useCompTier, useBanUser, useUnbanUser } from '@/hooks/useAdminUsers'
import { useProfile } from '@/hooks/useProfile'

vi.mock('@/hooks/useAdminUsers')
vi.mock('@/hooks/useProfile')

const ME = 'me-0000'
const baseUser = {
  id: 'u1', email: 'alice@example.com', display_name: 'Alice', created_at: '2026-07-01T00:00:00Z',
  last_sign_in_at: '2026-07-06T00:00:00Z', banned_until: null, subscription_tier: 'free',
  subscription_status: 'active', current_period_end: null, is_admin: false, has_stripe_subscription: false,
}
const baseDetail = {
  user: baseUser,
  counts: { clients: 2, projects: 3, invoices: 4, hoursTracked: 12.5, invoiced: [{ currency: 'USD', total: 1234.5 }] },
  history: [{ id: 'e1', created_at: '2026-07-07T00:00:00Z', payload: { action: 'comp', from: 'free', to: 'tier_1', actor_email: 'admin@loomlance.com' } }],
}
const idle = { mutate: vi.fn(), isPending: false }

function renderPage(id = 'u1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${id}`]}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useProfile.mockReturnValue({ data: { id: ME, is_admin: true } })
  useCompTier.mockReturnValue(idle)
  useBanUser.mockReturnValue(idle)
  useUnbanUser.mockReturnValue(idle)
})

describe('AdminUserDetailPage', () => {
  it('renders identity, counts, and history', () => {
    useAdminUserDetail.mockReturnValue({ data: baseDetail, isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('$1,234.50')).toBeInTheDocument()
    expect(screen.getByText(/Comped/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ban/i })).toBeInTheDocument()
  })
  it('disables comp for a user with a live Stripe subscription', () => {
    useAdminUserDetail.mockReturnValue({
      data: { ...baseDetail, user: { ...baseUser, has_stripe_subscription: true } },
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    renderPage()
    expect(screen.getByText(/manage it in Stripe/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled()
  })
  it('hides the ban control for self, demo, and admins', () => {
    for (const user of [
      { ...baseUser, id: ME },
      { ...baseUser, id: 'd3a70000-0000-4000-8000-000000000001' },
      { ...baseUser, is_admin: true },
    ]) {
      useAdminUserDetail.mockReturnValue({ data: { ...baseDetail, user }, isLoading: false, isError: false, refetch: vi.fn() })
      const { unmount } = renderPage(user.id)
      expect(screen.queryByRole('button', { name: /^ban/i })).not.toBeInTheDocument()
      unmount()
    }
  })
  it('shows Unban for a banned user', () => {
    useAdminUserDetail.mockReturnValue({
      data: { ...baseDetail, user: { ...baseUser, banned_until: '2099-01-01T00:00:00Z' } },
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    renderPage()
    expect(screen.getByRole('button', { name: /unban/i })).toBeInTheDocument()
  })
})
