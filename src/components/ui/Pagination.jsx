import { Button } from './Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page, pageSize, total, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-3">
      <p className="text-xs text-fg-muted tabular-nums">
        Page {page + 1} of {totalPages} — {total} total
      </p>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Previous">
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
          aria-label="Next"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
