// src/components/layout/__tests__/NotificationBell.test.jsx — external link_to handling
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { NotificationBell } from '../NotificationBell'
import { useNotifications, useUnreadCount, useMarkAllRead, useMarkRead } from '@/hooks/useNotifications'

vi.mock('@/hooks/useNotifications')

const externalNote = {
  id: 'n1', kind: 'announcement', link_to: 'https://loomlance.com/blog/big-release',
  payload: { title: 'Big Release', body: 'Something shipped.' }, read_at: null, created_at: '2026-07-08T00:00:00Z',
}
const internalNote = {
  id: 'n2', kind: 'invoice_paid', link_to: '/invoices/123',
  payload: { title: 'Invoice paid' }, read_at: null, created_at: '2026-07-08T00:00:00Z',
}

function renderBell(notes) {
  useNotifications.mockReturnValue({ data: notes })
  useUnreadCount.mockReturnValue({ data: notes.filter((n) => !n.read_at).length })
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useMarkAllRead.mockReturnValue({ mutate: vi.fn() })
  useMarkRead.mockReturnValue({ mutate: vi.fn() })
})

describe('NotificationBell', () => {
  it('renders external link_to as a new-tab anchor', async () => {
    renderBell([externalNote])
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    const row = screen.getByRole('link', { name: /Big Release/ })
    expect(row).toHaveAttribute('href', 'https://loomlance.com/blog/big-release')
    expect(row).toHaveAttribute('target', '_blank')
    expect(row.getAttribute('rel')).toMatch(/noopener/)
  })
  it('renders internal link_to as a router link', async () => {
    renderBell([internalNote])
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    const row = screen.getByRole('link', { name: /Invoice paid/ })
    expect(row).toHaveAttribute('href', '/invoices/123')
    expect(row).not.toHaveAttribute('target')
  })
  it('clicking an external row marks it read', async () => {
    const markRead = { mutate: vi.fn() }
    useMarkRead.mockReturnValue(markRead)
    renderBell([externalNote])
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    await userEvent.click(screen.getByRole('link', { name: /Big Release/ }))
    expect(markRead.mutate).toHaveBeenCalledWith('n1')
  })
})
