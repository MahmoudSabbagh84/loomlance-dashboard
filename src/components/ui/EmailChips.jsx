import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from './cn'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// An email recipient input that behaves like the To/Cc field of a real mail app:
// type an address and Enter / comma / semicolon / blur turns it into a removable
// chip; pasting a list splits it; Backspace on an empty input removes the last chip.
// Valid, de-duplicated (case-insensitive) addresses are committed; an invalid
// remainder stays in the box with a danger outline so it can be corrected.
export function EmailChips({ id, value = [], onChange, placeholder = 'name@example.com', 'aria-label': ariaLabel }) {
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)

  const commit = (raw) => {
    const parts = String(raw)
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const next = [...value]
    let bad = ''
    for (const p of parts) {
      if (!EMAIL_RE.test(p)) {
        bad = p
        continue
      }
      if (!next.some((e) => e.toLowerCase() === p.toLowerCase())) next.push(p)
    }
    if (next.length !== value.length) onChange(next)
    setDraft(bad)
    setInvalid(Boolean(bad))
  }

  const remove = (email) => onChange(value.filter((e) => e !== email))

  return (
    <div
      onClick={(e) => e.currentTarget.querySelector('input')?.focus()}
      className={cn(
        'flex min-h-[2.625rem] flex-wrap items-center gap-1.5 rounded-lg border bg-bg-elevated px-2 py-1.5 transition-colors focus-within:border-primary',
        invalid ? 'border-danger' : 'border-border'
      )}
    >
      {value.map((email) => (
        <span key={email} className="inline-flex items-center gap-1 rounded-md bg-bg-muted py-0.5 pl-2 pr-1 text-sm text-fg">
          {email}
          <button
            type="button"
            onClick={() => remove(email)}
            aria-label={`Remove ${email}`}
            className="grid size-4 place-items-center rounded text-fg-muted transition-colors hover:text-danger"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        type="email"
        autoComplete="off"
        aria-label={ariaLabel}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-fg outline-none placeholder:text-fg-subtle"
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => {
          setDraft(e.target.value)
          if (invalid) setInvalid(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
            e.preventDefault()
            commit(draft)
          } else if (e.key === 'Backspace' && !draft && value.length) {
            remove(value[value.length - 1])
          }
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft)
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          if (/[,;\s]/.test(text)) {
            e.preventDefault()
            commit(text)
          }
        }}
      />
    </div>
  )
}
