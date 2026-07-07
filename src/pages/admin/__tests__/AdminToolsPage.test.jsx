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
})
