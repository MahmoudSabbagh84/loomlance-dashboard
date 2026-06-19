import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'

function compactTick(value) {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`
  return String(value)
}

export default function ReportChart({ data, bars, height = 256, formatValue }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
        <YAxis tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={compactTick} />
        <Tooltip
          cursor={{ fill: 'var(--color-bg-muted)' }}
          contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'var(--color-fg-muted)' }}
          itemStyle={{ color: 'var(--color-fg)' }}
          formatter={formatValue ? (value, name) => [formatValue(Number(value), name), name] : undefined}
        />
        {bars.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {bars.map((b) => (
          <Bar key={b.dataKey} dataKey={b.dataKey} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={48} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
