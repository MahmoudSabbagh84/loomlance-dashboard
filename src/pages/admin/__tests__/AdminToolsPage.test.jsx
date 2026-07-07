// src/pages/admin/__tests__/AdminToolsPage.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminToolsPage from '../AdminToolsPage'
import { useAppConfig, useUpdateAppConfig } from '@/hooks/useAppConfig'

vi.mock('@/hooks/useAppConfig')
vi.mock('@/api/admin')

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/tools']}>
      <AdminToolsPage />
    </MemoryRouter>
  )
}

describe('AdminToolsPage — maintenance banner card', () => {
  beforeEach(() => {
    useUpdateAppConfig.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })
  it('saves the entered banner text', async () => {
    const mutate = vi.fn()
    useAppConfig.mockReturnValue({ data: { maintenance_banner: null } })
    useUpdateAppConfig.mockReturnValue({ mutate, isPending: false })
    renderPage()
    await userEvent.type(screen.getByLabelText('Maintenance banner'), 'Deploying 22:00 UTC')
    await userEvent.click(screen.getByRole('button', { name: /save banner/i }))
    expect(mutate).toHaveBeenCalledWith({ maintenance_banner: 'Deploying 22:00 UTC' }, expect.anything())
  })
  it('clears an active banner', async () => {
    const mutate = vi.fn()
    useAppConfig.mockReturnValue({ data: { maintenance_banner: 'Live now' } })
    useUpdateAppConfig.mockReturnValue({ mutate, isPending: false })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(mutate).toHaveBeenCalledWith({ maintenance_banner: null }, expect.anything())
  })
  it('hides Clear when no banner is set', () => {
    useAppConfig.mockReturnValue({ data: { maintenance_banner: null } })
    renderPage()
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
  })
  it('disables Save when text is unchanged or emptied — Clear is the only way down', async () => {
    useAppConfig.mockReturnValue({ data: { maintenance_banner: 'Live now' } })
    renderPage()
    const save = screen.getByRole('button', { name: /save banner/i })
    expect(save).toBeDisabled() // unchanged
    await userEvent.clear(screen.getByLabelText('Maintenance banner'))
    expect(save).toBeDisabled() // emptied — cannot "save empty"
  })
  it('trims banner text on save', async () => {
    const mutate = vi.fn()
    useAppConfig.mockReturnValue({ data: { maintenance_banner: null } })
    useUpdateAppConfig.mockReturnValue({ mutate, isPending: false })
    renderPage()
    await userEvent.type(screen.getByLabelText('Maintenance banner'), '  spaced out  ')
    await userEvent.click(screen.getByRole('button', { name: /save banner/i }))
    expect(mutate).toHaveBeenCalledWith({ maintenance_banner: 'spaced out' }, expect.anything())
  })
  it('shows an error state with retry when config fails to load', () => {
    useAppConfig.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText(/Couldn.t load the current banner state/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Maintenance banner')).not.toBeInTheDocument()
  })
})
