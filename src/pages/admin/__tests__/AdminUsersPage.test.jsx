// src/pages/admin/__tests__/AdminUsersPage.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminUsersPage from '../AdminUsersPage'
import { useAdminUsers } from '@/hooks/useAdminUsers'

vi.mock('@/hooks/useAdminUsers')

const users = [
  { id: 'u1', email: 'alice@example.com', display_name: 'Alice', created_at: '2026-07-01T00:00:00Z',
    last_sign_in_at: '2026-07-06T00:00:00Z', banned_until: null, subscription_tier: 'tier_2',
    subscription_status: 'active', current_period_end: null, is_admin: false, has_stripe_subscription: true },
  { id: 'u2', email: 'bob@example.com', display_name: 'Bob', created_at: '2026-06-01T00:00:00Z',
    last_sign_in_at: null, banned_until: '2099-01-01T00:00:00Z', subscription_tier: 'free',
    subscription_status: 'active', current_period_end: null, is_admin: false, has_stripe_subscription: false },
  { id: 'd3a70000-0000-4000-8000-000000000001', email: 'demo@loomlance.com', display_name: 'LoomLance User',
    created_at: '2026-02-27T00:00:00Z', last_sign_in_at: '2026-06-30T00:00:00Z', banned_until: null,
    subscription_tier: 'tier_2', subscription_status: 'active', current_period_end: null,
    is_admin: false, has_stripe_subscription: false },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <AdminUsersPage />
    </MemoryRouter>
  )
}

describe('AdminUsersPage', () => {
  it('renders rows with badges and detail links', () => {
    useAdminUsers.mockReturnValue({ data: users, isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByRole('link', { name: 'alice@example.com' })).toHaveAttribute('href', '/admin/users/u1')
    expect(screen.getByText('Banned')).toBeInTheDocument()
    expect(screen.getByText('Demo')).toBeInTheDocument()
  })
  it('search filters by email or name', async () => {
    useAdminUsers.mockReturnValue({ data: users, isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'alice')
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument()
  })
  it('shows an error state with retry on failure', () => {
    useAdminUsers.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText(/Couldn.t load users/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
