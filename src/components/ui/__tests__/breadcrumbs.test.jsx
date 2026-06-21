import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Breadcrumbs } from '../Breadcrumbs'

describe('Breadcrumbs', () => {
  it('renders parent as a link and current as plain text', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: 'Clients', to: '/clients' }, { label: 'Acme Corp' }]} />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Clients' })
    expect(link).toHaveAttribute('href', '/clients')
    // current page is not a link
    expect(screen.queryByRole('link', { name: 'Acme Corp' })).toBeNull()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })
})
