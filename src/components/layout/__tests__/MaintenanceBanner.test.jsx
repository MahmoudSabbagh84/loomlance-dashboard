// src/components/layout/__tests__/MaintenanceBanner.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MaintenanceBanner } from '../MaintenanceBanner'
import { useAppConfig } from '@/hooks/useAppConfig'

vi.mock('@/hooks/useAppConfig')

describe('MaintenanceBanner', () => {
  it('renders the banner text when set', () => {
    useAppConfig.mockReturnValue({ data: { maintenance_banner: 'Payments degraded — investigating.' } })
    render(<MaintenanceBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Payments degraded — investigating.')
  })
  it.each([[null], [''], ['   ']])('renders nothing for %j', (value) => {
    useAppConfig.mockReturnValue({ data: { maintenance_banner: value } })
    const { container } = render(<MaintenanceBanner />)
    expect(container).toBeEmptyDOMElement()
  })
  it('renders nothing while loading or on error', () => {
    useAppConfig.mockReturnValue({ data: undefined })
    const { container } = render(<MaintenanceBanner />)
    expect(container).toBeEmptyDOMElement()
  })
})
