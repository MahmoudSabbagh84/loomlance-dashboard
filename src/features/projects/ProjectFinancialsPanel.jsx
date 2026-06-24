import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { formatCurrency } from '@/lib/currency'
import { useProfile } from '@/hooks/useProfile'
import { useProjectFinancials } from '@/hooks/useProjectFinancials'
import { BudgetModal } from './BudgetModal'
import { BudgetHistoryModal } from './BudgetHistoryModal'

function Metric({ label, value, currency, tone, sub }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-fg-muted">{label}</p>
      <div className={cn('mt-1 text-lg font-semibold tabular-nums', tone)}>{formatCurrency(value, currency)}</div>
      {sub ? <p className="mt-0.5 truncate text-xs tabular-nums text-fg-subtle">{sub}</p> : null}
    </div>
  )
}

function BurnBar({ invoiced, budget, remaining, currency }) {
  const over = invoiced > budget
  const pct = budget > 0 ? Math.min(100, Math.max(0, (invoiced / budget) * 100)) : 0
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span className="text-fg-muted">
          <span className="font-semibold tabular-nums text-fg">{formatCurrency(invoiced, currency)}</span> invoiced of{' '}
          {formatCurrency(budget, currency)}
        </span>
        <span className={cn('font-medium tabular-nums', over ? 'text-danger' : 'text-fg-muted')}>
          {over
            ? `${formatCurrency(invoiced - budget, currency)} over budget`
            : `${formatCurrency(remaining, currency)} remaining`}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
            over ? 'bg-danger' : 'bg-primary'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function ProjectFinancialsPanel({ project }) {
  const { data: profile } = useProfile()
  const currency = project.budget_currency || profile?.default_currency || 'USD'
  const budget = project.budget_amount
  const hasBudget = budget != null
  const { data: fin, isLoading } = useProjectFinancials(project.id, currency, budget)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Financials</h2>
        <div className="flex items-center gap-2">
          {hasBudget ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setHistoryOpen(true)}>
                History
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setBudgetOpen(true)}>
                Adjust budget
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setBudgetOpen(true)}>
              Set a budget
            </Button>
          )}
        </div>
      </div>

      {isLoading || !fin ? (
        <Skeleton className="mt-4 h-28" />
      ) : (
        <>
          {hasBudget ? (
            <BurnBar invoiced={fin.invoiced} budget={budget} remaining={fin.remaining} currency={currency} />
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Metric
              label="Invoiced"
              value={fin.invoiced}
              currency={currency}
              sub={fin.draftInvoiced > 0 ? `+ ${formatCurrency(fin.draftInvoiced, currency)} draft` : null}
            />
            <Metric label="Paid" value={fin.paid} currency={currency} />
            <Metric label="Expenses" value={fin.expenses} currency={currency} />
            <Metric label="Unbilled to invoice" value={fin.unbilledToInvoice} currency={currency} />
            <Metric
              label="Profit"
              value={fin.profit}
              currency={currency}
              tone={fin.profit >= 0 ? 'text-success' : 'text-danger'}
            />
          </div>

          {fin.excludedCount > 0 ? (
            <p className="mt-3 text-xs text-fg-muted">
              {fin.excludedCount} {fin.excludedCount === 1 ? 'item' : 'items'} in another currency{' '}
              {fin.excludedCount === 1 ? 'is' : 'are'} excluded.
            </p>
          ) : null}
        </>
      )}

      <BudgetModal open={budgetOpen} onClose={() => setBudgetOpen(false)} project={project} />
      <BudgetHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} projectId={project.id} />
    </Card>
  )
}
