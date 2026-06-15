import { cn } from './cn'

export function Tabs({ value, onChange, items }) {
  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex gap-6" aria-label="Tabs">
        {items.map((item) => {
          const active = item.key === value
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={cn(
                'whitespace-nowrap border-b-2 py-3 text-sm font-medium',
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
