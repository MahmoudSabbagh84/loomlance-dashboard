import { formatCurrency } from '@/lib/currency'

export function TopClients({ clientTotals, currency }) {
  const rows = Object.entries(clientTotals || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (rows.length === 0) {
    return <p className="text-sm text-fg-muted">No paid revenue yet.</p>
  }

  const max = rows[0][1] || 1
  return (
    <ul className="space-y-2.5">
      {rows.map(([name, amount]) => (
        <li key={name}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm">{name}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums">{formatCurrency(amount, currency)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (amount / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
