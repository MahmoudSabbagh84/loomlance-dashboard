import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '@/components/ui/Modal'

describe('Modal (accessible dialog)', () => {
  it('is a labelled modal dialog, moves focus inside, and closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Edit client">
        <button>Save</button>
      </Modal>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Edit client') // aria-labelledby → title
    // focus trap moves focus to the first focusable (the Close button)
    expect(document.activeElement).toBe(screen.getByLabelText('Close'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uses aria-label as the accessible name when there is no title', () => {
    render(
      <Modal open onClose={() => {}} aria-label="Confirm deletion">
        <button>OK</button>
      </Modal>
    )
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Confirm deletion')
  })
})
