import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignaturePad } from '../SignaturePad'

describe('SignaturePad', () => {
  it('renders a canvas and a Clear button', () => {
    render(<SignaturePad value="" onChange={() => {}} />)
    expect(screen.getByLabelText(/signature/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })
  it('Clear resets the signature to empty', async () => {
    const onChange = vi.fn()
    render(<SignaturePad value="data:image/png;base64,x" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(onChange).toHaveBeenCalledWith('')
  })
})
