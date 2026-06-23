import { useEffect } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

// Accessible dialog focus management. While `active`, focus is moved into `ref`
// (first focusable, else the container), Tab/Shift+Tab cycle within it, and on
// deactivate focus is restored to whatever was focused before it opened.
// WCAG 2.4.3 (Focus Order) / 2.1.2 (No Keyboard Trap).
export function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active) return undefined
    const node = ref.current
    if (!node) return undefined

    const previouslyFocused = document.activeElement

    const focusables = () =>
      Array.from(node.querySelectorAll(FOCUSABLE)).filter((el) => !el.hidden)

    // Move focus into the dialog on open.
    const first = focusables()[0]
    if (first) {
      first.focus()
    } else {
      node.setAttribute('tabindex', '-1')
      node.focus()
    }

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      // Restore focus to the trigger when the dialog closes.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [ref, active])
}
