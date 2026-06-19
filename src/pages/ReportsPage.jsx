import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/components/ui/cn'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile } from '@/hooks/useProfile'
import { hasFeature, FEATURES } from '@/lib/tier'
import { rangeForPreset } from '@/lib/reports'
import { DateRangeControl } from '@/features/reports/DateRangeControl'
import { RevenueReport } from '@/features/reports/RevenueReport'
import { PnLReport } from '@/features/reports/PnLReport'
import { AgingReport } from '@/features/reports/AgingReport'
import { TimeReport } from '@/features/reports/TimeReport'

const TABS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'pnl', label: 'P&L' },
  { key: 'aging', label: 'Aging' },
  { key: 'time', label: 'Time' },
]

export default function ReportsPage() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [tab, setTab] = useState('revenue')
  const [range, setRange] = useState(() => ({ preset: 'this_month', ...rangeForPreset('this_month', new Date()) }))

  if (!hasFeature(tier, FEATURES.REPORTS)) {
    return (
      <div className="space-y-5">
        <PageHeader title="Reports" />
        <UpgradeCard feature={FEATURES.REPORTS} currentTier={tier} target="tier_2" />
      </div>
    )
  }

  const rangeValid = !!range.from && !!range.to && range.from <= range.to
  const showRange = tab !== 'aging'

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Revenue, P&L, aging, and time" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                tab === t.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-fg-muted hover:bg-bg-muted hover:text-fg'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {showRange ? <DateRangeControl value={range} onChange={setRange} /> : null}
      </div>

      {tab === 'revenue' && (rangeValid ? <RevenueReport range={range} /> : null)}
      {tab === 'pnl' && (rangeValid ? <PnLReport range={range} /> : null)}
      {tab === 'aging' && <AgingReport />}
      {tab === 'time' && (rangeValid ? <TimeReport range={range} /> : null)}
    </div>
  )
}
