import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContractSignaturePanel } from '../ContractSignaturePanel'
import * as hooks from '@/hooks/useContracts'
import { useProfile } from '@/hooks/useProfile'

vi.mock('@/hooks/useContracts')
vi.mock('@/hooks/useProfile')

const idle = { mutate: vi.fn(), isPending: false }

function renderPanel(contract) {
  return render(<ContractSignaturePanel contract={contract} />)
}

beforeEach(() => {
  hooks.useSendContract.mockReturnValue(idle)
  hooks.useRegenerateContractLink.mockReturnValue(idle)
  useProfile.mockReturnValue({ data: { business_name: 'DevShop' } })
})

describe('ContractSignaturePanel', () => {
  it('shows Send for signature on a draft contract', () => {
    renderPanel({ id: 'k1', status: 'draft', clients: { name: 'Acme' } })
    expect(screen.getByRole('button', { name: /send for signature/i })).toBeInTheDocument()
  })
  it('clicking Send calls the send mutation with the contract', async () => {
    const mutate = vi.fn()
    hooks.useSendContract.mockReturnValue({ mutate, isPending: false })
    const contract = { id: 'k1', status: 'draft', clients: { name: 'Acme' } }
    renderPanel(contract)
    await userEvent.click(screen.getByRole('button', { name: /send for signature/i }))
    expect(mutate).toHaveBeenCalledWith(contract, expect.anything())
  })
  it('shows the copy-link control for a sent contract', () => {
    renderPanel({ id: 'k1', status: 'sent', public_token: 'tok1', clients: { name: 'Acme' } })
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })
  it('shows the signer and a download button once signed', () => {
    renderPanel({
      id: 'k1', status: 'active', signed_at: '2026-07-09T00:00:00Z', signer_name: 'Jane Client',
      clients: { name: 'Acme' },
    })
    expect(screen.getByText(/Jane Client/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download signed certificate/i })).toBeInTheDocument()
  })
})
