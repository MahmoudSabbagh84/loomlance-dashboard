import { Badge } from '@/components/ui/Badge'

const SEGMENTS = [
  { key: 'free', label: 'Free', className: 'bg-bg-muted' },
  { key: 'tier_1', label: 'Tier 1', className: 'bg-primary/40' },
  { key: 'tier_2', label: 'Tier 2', className: 'bg-primary' },
]

export function TierBar({ tiers }) {
  const total = SEGMENTS.reduce((s, seg) => s + (tiers[seg.key] || 0), 0) || 1
  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-bg-muted"
        role="img"
        aria-label={`Tier mix: ${SEGMENTS.map((s) => `${s.label} ${tiers[s.key] || 0}`).join(', ')}`}
      >
        {SEGMENTS.map((s, i) => (
          <div
            key={s.key}
            className={s.className}
            style={{
              width: `${((tiers[s.key] || 0) / total) * 100}%`,
              boxShadow: i < SEGMENTS.length - 1 ? 'inset -2px 0 0 0 var(--color-bg-elevated)' : 'none',
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="tabular-nums">{s.label} · {tiers[s.key] || 0}</span>
        ))}
        {tiers.pastDue > 0 && <Badge variant="danger">{tiers.pastDue} past due</Badge>}
      </div>
    </div>
  )
}
