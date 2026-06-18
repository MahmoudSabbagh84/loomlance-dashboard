import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Users, Briefcase, FileText } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/components/ui/cn'
import { searchEverything } from './globalSearch'

const ICONS = { Client: Users, Project: Briefcase, Invoice: FileText }

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const debounced = useDebouncedValue(query, 200)
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const activeRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('loomlance:open-search', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('loomlance:open-search', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [debounced])

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => searchEverything(debounced),
    enabled: open && debounced.trim().length > 0,
    staleTime: 30_000,
  })

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const go = (r) => {
    setOpen(false)
    navigate(r.to)
  }

  const onInputKey = (e) => {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[active]) go(results[active])
    }
  }

  const hasQuery = debounced.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="animate-pop-in w-full max-w-xl overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-fg-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search clients, projects, invoices…"
            className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-fg-subtle sm:block">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {!hasQuery ? (
            <p className="px-3 py-6 text-center text-sm text-fg-muted">Type to search…</p>
          ) : isFetching && results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-fg-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-fg-muted">No results for “{debounced}”</p>
          ) : (
            results.map((r, i) => {
              const Icon = ICONS[r.type] || Search
              const isActive = i === active
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  ref={isActive ? activeRef : null}
                  type="button"
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                    isActive ? 'bg-primary/10' : 'hover:bg-bg-muted'
                  )}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-bg-muted">
                    <Icon className="size-4 text-fg-muted" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{r.title}</span>
                    {r.subtitle ? <span className="block truncate text-xs text-fg-muted">{r.subtitle}</span> : null}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-fg-subtle">{r.type}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
