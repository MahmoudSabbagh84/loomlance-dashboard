import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: () => ({
    data: { revenueByCurrency: { USD: 8450 }, outstandingByCurrency: { USD: 1200 }, overdueCount: 2, activeProjectCount: 3 },
    isLoading: false,
  }),
}))
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ data: { subscription_tier: 'tier_1' } }) }))

import { StatsRow } from '@/features/dashboard/StatsRow'

describe('StatsRow', () => {
  it('leads with Revenue and labels the overdue stat correctly', () => {
    render(<StatsRow />)
    expect(screen.getByText('Revenue this month')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    // Regression: the stat that shows overdueCount must NOT be mislabeled "Open invoices".
    expect(screen.queryByText('Open invoices')).toBeNull()
    expect(screen.getByText('Outstanding')).toBeInTheDocument()
    expect(screen.getByText('Active projects')).toBeInTheDocument()
  })
})
