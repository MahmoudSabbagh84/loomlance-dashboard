import { cn } from '@/components/ui/cn'

export function CurrencyTabs({ currencies, value, onChange }) {
  if (!currencies || currencies.length <= 1) return null
  return (
    <div className="flex gap-1">
      {currencies.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-pressed={c === value}
          aria-label={`Show ${c} amounts`}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium tabular-nums transition-colors',
            c === value ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-bg-muted'
          )}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
