import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ChangeRequestsPanel } from '../ChangeRequestsPanel'
import * as hooks from '@/hooks/useChangeRequests'

vi.mock('@/hooks/useChangeRequests')

const project = { id: 'p1', client_id: 'c1', budget_currency: 'USD' }
const idle = { mutate: vi.fn(), isPending: false }
const baseRow = {
  id: 'cr1', title: 'Extra API endpoints', currency: 'USD', amount: 800, added_days: 3,
  status: 'approved', public_token: 'tok1', billed_invoice_id: null,
}

function renderPanel(rows) {
  hooks.useChangeRequests.mockReturnValue({ data: rows, isLoading: false })
  return render(
    <MemoryRouter>
      <ChangeRequestsPanel project={project} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  hooks.useSendChangeRequest.mockReturnValue(idle)
  hooks.useRegenerateChangeRequestLink.mockReturnValue(idle)
  hooks.useBillChangeRequest.mockReturnValue(idle)
  hooks.useDeleteChangeRequest.mockReturnValue(idle)
  hooks.useCreateChangeRequest.mockReturnValue(idle)
})

describe('ChangeRequestsPanel', () => {
  it('renders a request with its status badge and formatted amount', () => {
    renderPanel([baseRow])
    expect(screen.getByText('Extra API endpoints')).toBeInTheDocument()
    expect(screen.getByText('$800.00')).toBeInTheDocument()
    expect(screen.getByText('approved')).toBeInTheDocument()
  })
  it('an approved, not-yet-billed request shows an enabled Bill this change button', () => {
    renderPanel([baseRow])
    expect(screen.getByRole('button', { name: /bill this change/i })).toBeEnabled()
  })
  it('a billed request shows Billed and no bill button', () => {
    renderPanel([{ ...baseRow, billed_invoice_id: 'inv1' }])
    expect(screen.getByText('Billed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bill this change/i })).not.toBeInTheDocument()
  })
  it('renders an empty state when there are no change requests', () => {
    renderPanel([])
    expect(screen.getByText(/No change requests/)).toBeInTheDocument()
  })
  it('opens the create modal from New change request', async () => {
    renderPanel([])
    await userEvent.click(screen.getByRole('button', { name: /new change request/i }))
    expect(screen.getByRole('heading', { name: /New change request/i })).toBeInTheDocument()
  })
})
