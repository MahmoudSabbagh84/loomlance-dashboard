import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmailChips } from '@/components/ui/EmailChips'

function Harness({ initial = [] }) {
  const [v, setV] = useState(initial)
  return <EmailChips aria-label="To" value={v} onChange={setV} />
}

describe('EmailChips', () => {
  it('commits a valid email as a chip on Enter, then removes it via the ×', () => {
    render(<Harness />)
    const input = screen.getByLabelText('To')
    fireEvent.change(input, { target: { value: 'a@b.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Remove a@b.com'))
    expect(screen.queryByText('a@b.com')).toBeNull()
  })

  it('rejects an invalid address — no chip, text stays in the box', () => {
    render(<Harness />)
    const input = screen.getByLabelText('To')
    fireEvent.change(input, { target: { value: 'not-an-email' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryByLabelText('Remove not-an-email')).toBeNull()
    expect(input).toHaveValue('not-an-email')
  })

  it('de-duplicates case-insensitively', () => {
    render(<Harness initial={['a@b.com']} />)
    const input = screen.getByLabelText('To')
    fireEvent.change(input, { target: { value: 'A@B.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getAllByText(/a@b\.com/i)).toHaveLength(1)
  })
})
