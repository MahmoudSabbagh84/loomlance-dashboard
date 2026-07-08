import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminTabs } from '../AdminTabs'

describe('AdminTabs', () => {
  it('renders the five admin section links', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminTabs />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Pulse' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: 'Posts' })).toHaveAttribute('href', '/admin/posts')
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users')
    expect(screen.getByRole('link', { name: 'Tools' })).toHaveAttribute('href', '/admin/tools')
    expect(screen.getByRole('link', { name: 'Ops' })).toHaveAttribute('href', '/admin/ops')
  })
})
