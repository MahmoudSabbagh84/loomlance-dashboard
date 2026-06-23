import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export function Drawer({ open, onClose, title, children, side = 'right', width = 'w-[calc(100vw-2.5rem)] sm:w-[480px]' }) {
  const panelRef = useRef(null)
  const titleId = useId()
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sideClass = side === 'right' ? 'right-0' : 'left-0'

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('absolute top-0 bottom-0 bg-bg-elevated border-l border-border shadow-2xl flex flex-col', sideClass, width)}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 id={titleId} className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}
