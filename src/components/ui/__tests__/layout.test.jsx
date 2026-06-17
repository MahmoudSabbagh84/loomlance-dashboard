import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '../PageHeader'
import { Card } from '../Card'

describe('PageHeader', () => {
  it('renders title, subtitle, and actions', () => {
    render(<PageHeader title="Clients" subtitle="Manage them"><button>New</button></PageHeader>)
    expect(screen.getByRole('heading', { name: 'Clients' })).toBeInTheDocument()
    expect(screen.getByText('Manage them')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('renders children inside a surface', () => {
    render(<Card>hello</Card>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
