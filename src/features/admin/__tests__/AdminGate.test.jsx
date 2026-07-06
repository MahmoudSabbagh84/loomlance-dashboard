import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminGate } from '../AdminGate'
import { useProfile } from '@/hooks/useProfile'

vi.mock('@/hooks/useProfile')

function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/admin" element={<AdminGate><p>admin area</p></AdminGate>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AdminGate', () => {
  it('renders children for admins', () => {
    useProfile.mockReturnValue({ data: { is_admin: true }, isLoading: false })
    renderGate()
    expect(screen.getByText('admin area')).toBeInTheDocument()
  })
  it('redirects non-admins home', () => {
    useProfile.mockReturnValue({ data: { is_admin: false }, isLoading: false })
    renderGate()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
    expect(screen.getByText('home')).toBeInTheDocument()
  })
  it('shows nothing conclusive while loading', () => {
    useProfile.mockReturnValue({ data: undefined, isLoading: true })
    renderGate()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
    expect(screen.queryByText('home')).not.toBeInTheDocument()
  })
})
