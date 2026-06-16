import { Search, Clock, EyeOff, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cn } from '@/components/ui/cn'

function FilterToggle({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-fg-muted hover:bg-bg-muted hover:text-fg'
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  )
}

export function KanbanFilters({ value, onChange }) {
  const hasActive = value.search || value.priority || value.dueSoon || value.hideDone
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          placeholder="Filter cards…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="h-8 pl-9"
        />
      </div>
      <Select
        value={value.priority}
        onChange={(e) => onChange({ ...value, priority: e.target.value })}
        className="h-8 w-32"
      >
        <option value="">Any priority</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </Select>
      <FilterToggle active={value.dueSoon} onClick={() => onChange({ ...value, dueSoon: !value.dueSoon })} icon={Clock}>
        Due ≤ 7d
      </FilterToggle>
      <FilterToggle active={value.hideDone} onClick={() => onChange({ ...value, hideDone: !value.hideDone })} icon={EyeOff}>
        Hide Done
      </FilterToggle>
      {hasActive ? (
        <button
          type="button"
          onClick={() => onChange({ search: '', priority: '', dueSoon: false, hideDone: false })}
          className="inline-flex items-center gap-1 text-xs text-fg-subtle transition-colors hover:text-fg"
        >
          <X className="size-3.5" /> Clear
        </button>
      ) : null}
    </div>
  )
}
