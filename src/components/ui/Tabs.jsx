import { cn } from './cn'

export function Tabs({ value, onChange, items }) {
  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex gap-5" aria-label="Tabs">
        {items.map((item) => {
          const active = item.key === value
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={cn(
                'whitespace-nowrap border-b-2 py-2.5 text-sm font-medium transition-colors',
                active ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-fg'
              )}
            >
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
