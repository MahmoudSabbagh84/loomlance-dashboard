import { useRef } from 'react'
import { Check, Pipette } from 'lucide-react'
import { cn } from './cn'
import { PROJECT_COLORS } from '@/lib/colors'

const eq = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase()

export function ColorPicker({ value, onChange, presets = PROJECT_COLORS }) {
  const inputRef = useRef(null)
  const isCustom = !!value && !presets.some((c) => eq(c, value))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((c) => {
        const selected = eq(value, c)
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Color ${c}`}
            aria-pressed={selected}
            className={cn(
              'grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-bg-elevated transition',
              selected && 'ring-2 ring-fg',
            )}
            style={{ backgroundColor: c }}
          >
            {selected ? <Check className="size-4 text-white" /> : null}
          </button>
        )
      })}

      {/* Custom swatch — opens the native color picker. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Custom color"
        aria-pressed={isCustom}
        className={cn(
          'grid size-7 place-items-center rounded-full border border-border ring-offset-2 ring-offset-bg-elevated transition',
          isCustom && 'ring-2 ring-fg',
        )}
        style={isCustom ? { backgroundColor: value } : undefined}
      >
        {isCustom ? <Check className="size-4 text-white" /> : <Pipette className="size-3.5 text-fg-muted" />}
      </button>
      <input
        ref={inputRef}
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  )
}
