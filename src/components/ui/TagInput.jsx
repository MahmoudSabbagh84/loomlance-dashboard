import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from './cn'

export function TagInput({ value = [], onChange, placeholder = 'Add tag and press Enter' }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v) return
    if (value.includes(v)) { setDraft(''); return }
    onChange([...value, v])
    setDraft('')
  }
  const remove = (t) => onChange(value.filter((x) => x !== t))
  return (
    <div className={cn('flex flex-wrap items-center gap-1 rounded-md border border-border bg-bg px-2 py-1.5 min-h-[2.5rem]')}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-bg-muted px-2 py-0.5 text-xs">
          {t}
          <button type="button" onClick={() => remove(t)} className="text-fg-muted hover:text-fg" aria-label={`Remove ${t}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 bg-transparent text-sm outline-none min-w-[8rem] px-1"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !draft && value.length) { onChange(value.slice(0, -1)) }
        }}
        onBlur={add}
      />
    </div>
  )
}
