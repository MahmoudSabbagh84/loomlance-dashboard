import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import VaultPage from '../VaultPage'
import * as vault from '@/hooks/useVault'
import * as projects from '@/hooks/useProjects'

vi.mock('@/hooks/useVault')
vi.mock('@/hooks/useProjects')

const idle = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }
const rows = [
  { id: 'v1', label: 'Acme Stripe key', type: 'api_key', username: null, last_accessed_at: null },
  { id: 'v2', label: 'Prod database', type: 'database_url', username: 'admin', last_accessed_at: null },
]

function renderPage(data = rows) {
  vault.useVaultCredentials.mockReturnValue({ data, isLoading: false })
  return render(<MemoryRouter><VaultPage /></MemoryRouter>)
}

beforeEach(() => {
  vault.useSaveVaultCredential.mockReturnValue(idle)
  vault.useUpdateVaultMetadata.mockReturnValue(idle)
  vault.useDeleteVaultCredential.mockReturnValue(idle)
  vault.useRevealVaultSecret.mockReturnValue(idle)
  projects.useProjects.mockReturnValue({ data: [] })
})

describe('VaultPage', () => {
  it('renders an entry with its label, type, and a masked secret', () => {
    renderPage()
    expect(screen.getByText('Acme Stripe key')).toBeInTheDocument()
    // "API key" appears as both a filter <option> and the row badge → badge makes it >1.
    expect(screen.getAllByText('API key').length).toBeGreaterThan(1)
    expect(screen.getAllByText('••••••••').length).toBe(2)
  })
  it('reveals a secret via the reveal mutation', async () => {
    const mutate = vi.fn((_id, opts) => opts.onSuccess('sk_live_shown'))
    vault.useRevealVaultSecret.mockReturnValue({ mutate, isPending: false })
    renderPage()
    await userEvent.click(screen.getAllByRole('button', { name: /reveal/i })[0])
    expect(mutate).toHaveBeenCalledWith('v1', expect.anything())
    expect(screen.getByText('sk_live_shown')).toBeInTheDocument()
  })
  it('renders an empty state when there are no credentials', () => {
    renderPage([])
    expect(screen.getByText(/No credentials yet/i)).toBeInTheDocument()
  })
  it('opens the create modal from New credential', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /new credential/i }))
    expect(screen.getByRole('heading', { name: /New credential/i })).toBeInTheDocument()
  })
  it('filters the list by type', async () => {
    renderPage()
    await userEvent.selectOptions(screen.getByLabelText(/filter by type/i), 'database_url')
    expect(screen.queryByText('Acme Stripe key')).not.toBeInTheDocument()
    expect(screen.getByText('Prod database')).toBeInTheDocument()
  })
})
