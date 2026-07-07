import { Card } from '@/components/ui/Card'

export function StatTile({ label, value, sub }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-fg-muted">{sub}</p> : null}
    </Card>
  )
}
