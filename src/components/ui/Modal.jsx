import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export function Modal({ open, onClose, title, children, size = 'md', className, 'aria-label': ariaLabel }) {
  const panelRef = useRef(null)
  const titleId = useId()
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        className={cn('animate-pop-in relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-lg bg-bg-elevated shadow-2xl border border-border', sizes[size], className)}
      >
        {title ? (
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
            <h2 id={titleId} className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
        ) : null}
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}
