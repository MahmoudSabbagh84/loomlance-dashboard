import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { formatCurrency } from '@/lib/currency'

function compactTick(value) {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`
  return String(value)
}

export default function RevenueChart({ data, currency, onBarClick }) {
  return (
    <div className="select-none">
    <ResponsiveContainer width="100%" height={256}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
        <YAxis tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={compactTick} />
        <Tooltip
          cursor={{ fill: 'var(--color-bg-muted)' }}
          contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'var(--color-fg-muted)' }}
          itemStyle={{ color: 'var(--color-fg)' }}
          formatter={(value) => [formatCurrency(Number(value), currency), 'Revenue']}
        />
        <Bar
          dataKey="revenue"
          fill="var(--color-primary)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
          cursor={onBarClick ? 'pointer' : undefined}
          onClick={onBarClick ? (d) => { const k = d?.key ?? d?.payload?.key; if (k) onBarClick(k) } : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
    </div>
  )
}
