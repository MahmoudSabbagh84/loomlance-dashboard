import { useEffect } from 'react'
import { cn } from './cn'
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, size = 'md', className }) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('animate-pop-in relative w-full rounded-lg bg-bg-elevated shadow-2xl border border-border', sizes[size], className)}>
        {title ? (
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="text-fg-subtle hover:text-fg" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
        ) : null}
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
