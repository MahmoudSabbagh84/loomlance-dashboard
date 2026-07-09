import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PublicContractPage from '../PublicContractPage'
import { usePublicContract, useSignContract, useDeclineContract } from '@/hooks/usePublicContract'

vi.mock('@/hooks/usePublicContract')
vi.mock('@/features/contracts/SignaturePad', () => ({
  SignaturePad: ({ onChange }) => (
    <button type="button" onClick={() => onChange('data:image/png;base64,x')}>
      draw
    </button>
  ),
}))

const sent = {
  title: 'Design retainer', description: 'Terms', value: 5000, currency: 'USD',
  status: 'sent', already_signed: false, business_name: 'DevShop', client_name: 'Acme',
}

function renderPage(token = 't1') {
  return render(
    <MemoryRouter initialEntries={[`/c/${token}`]}>
      <Routes>
        <Route path="/c/:token" element={<PublicContractPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useSignContract.mockReturnValue({ mutate: vi.fn(), isPending: false })
  useDeclineContract.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe('PublicContractPage', () => {
  it('renders the terms and a disabled Sign until name+drawing+consent', async () => {
    usePublicContract.mockReturnValue({ data: sent, isLoading: false })
    renderPage()
    expect(screen.getByText('Design retainer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Client')
    await userEvent.click(screen.getByRole('button', { name: /draw/i }))
    await userEvent.click(screen.getByLabelText(/i agree/i))
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeEnabled()
  })
  it('signing calls the mutation with name + signature + consent', async () => {
    const mutate = vi.fn()
    useSignContract.mockReturnValue({ mutate, isPending: false })
    usePublicContract.mockReturnValue({ data: sent, isLoading: false })
    renderPage('t1')
    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Client')
    await userEvent.click(screen.getByRole('button', { name: /draw/i }))
    await userEvent.click(screen.getByLabelText(/i agree/i))
    await userEvent.click(screen.getByRole('button', { name: /^sign$/i }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ token: 't1', name: 'Jane Client', signatureImage: 'data:image/png;base64,x', consent: true }),
      expect.anything()
    )
  })
  it('shows a signed confirmation when already signed', () => {
    usePublicContract.mockReturnValue({
      data: { ...sent, status: 'active', already_signed: true, signer_name: 'Jane Client' },
      isLoading: false,
    })
    renderPage()
    expect(screen.getByText(/signed/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^sign$/i })).not.toBeInTheDocument()
  })
  it('shows invalid-link for a null payload', () => {
    usePublicContract.mockReturnValue({ data: null, isLoading: false })
    renderPage()
    expect(screen.getByText(/no longer valid/i)).toBeInTheDocument()
  })
  it('shows "no longer available" for a canceled (not-signed) contract', () => {
    usePublicContract.mockReturnValue({ data: { ...sent, status: 'canceled', already_signed: false }, isLoading: false })
    renderPage()
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^sign$/i })).not.toBeInTheDocument()
  })
  it('declining calls the decline mutation', async () => {
    const mutate = vi.fn()
    useDeclineContract.mockReturnValue({ mutate, isPending: false })
    usePublicContract.mockReturnValue({ data: sent, isLoading: false })
    renderPage('t1')
    await userEvent.click(screen.getByText(/decline this contract instead/i))
    await userEvent.click(screen.getByRole('button', { name: /^decline$/i }))
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ token: 't1' }), expect.anything())
  })
})
