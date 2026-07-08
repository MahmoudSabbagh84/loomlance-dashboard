import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PublicChangeRequestPage from '../PublicChangeRequestPage'
import { usePublicChangeRequest, useRespondToChangeRequest } from '@/hooks/useChangeRequests'

vi.mock('@/hooks/useChangeRequests')

const sentPayload = {
  title: 'Extra API endpoints', description: 'Three more endpoints.', currency: 'USD',
  amount: 800, hours: 8, hourly_rate: 100, added_days: 3, status: 'sent',
  already_decided: false, business_name: 'DevShop', client_name: 'Acme',
}

function renderPage(token = 'tok1') {
  return render(
    <MemoryRouter initialEntries={[`/cr/${token}`]}>
      <Routes>
        <Route path="/cr/:token" element={<PublicChangeRequestPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useRespondToChangeRequest.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe('PublicChangeRequestPage', () => {
  it('renders a sent request with amount and Approve/Decline', () => {
    usePublicChangeRequest.mockReturnValue({ data: sentPayload, isLoading: false })
    renderPage()
    expect(screen.getByText('Extra API endpoints')).toBeInTheDocument()
    expect(screen.getByText('$800.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
  })
  it('Approve sends the typed name to the mutation', async () => {
    const mutate = vi.fn()
    useRespondToChangeRequest.mockReturnValue({ mutate, isPending: false })
    usePublicChangeRequest.mockReturnValue({ data: sentPayload, isLoading: false })
    renderPage('tok1')
    await userEvent.type(screen.getByLabelText(/your name/i), 'Jane Client')
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok1', decision: 'approve', approverName: 'Jane Client' }),
      expect.anything()
    )
  })
  it('shows the decided state and no action buttons when already decided', () => {
    usePublicChangeRequest.mockReturnValue({
      data: { ...sentPayload, status: 'approved', already_decided: true, approver_name: 'Jane Client' },
      isLoading: false,
    })
    renderPage()
    expect(screen.getByText(/approved/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument()
  })
  it('shows an invalid-link message for a null payload', () => {
    usePublicChangeRequest.mockReturnValue({ data: null, isLoading: false })
    renderPage()
    expect(screen.getByText(/no longer valid/i)).toBeInTheDocument()
  })
})
