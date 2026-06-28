import { useState } from 'react'
import { Plus, Receipt, SearchX } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Toolbar } from '@/components/ui/Toolbar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile } from '@/hooks/useProfile'
import { useProjects } from '@/hooks/useProjects'
import { useExpenses, useDeleteExpense } from '@/hooks/useExpenses'
import { getReceiptUrl } from '@/api/expenses'
import { hasFeature, FEATURES } from '@/lib/tier'
import { expenseTotals, EXPENSE_CATEGORIES } from '@/lib/expenses'
import { formatCurrency } from '@/lib/currency'
import { ExpensesTable } from '@/features/expenses/ExpensesTable'
import { ExpenseFormModal } from '@/features/expenses/ExpenseFormModal'
import { ExpensesReadyToBillPanel } from '@/features/expenses/ExpensesReadyToBillPanel'

export default function ExpensesPage() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const { data: projects = [] } = useProjects({ status: 'all' })
  const [projectId, setProjectId] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const del = useDeleteExpense()
  const { data: expenses = [], isLoading } = useExpenses({
    projectId: projectId || undefined,
    category: category || undefined,
    status,
  })

  if (!hasFeature(tier, FEATURES.EXPENSES)) {
    return (
      <div className="space-y-5">
        <PageHeader title="Expenses" />
        <UpgradeCard feature={FEATURES.EXPENSES} currentTier={tier} target="tier_2" />
      </div>
    )
  }

  const currency = profile?.default_currency || 'USD'
  const totals = expenseTotals(expenses)
  const hasActiveFilters = projectId !== '' || category !== '' || status !== 'all'

  const openReceipt = async (path) => {
    try {
      const url = await getReceiptUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error(e.userMessage || 'Could not open receipt')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Expenses" subtitle="Track costs and bill them back">
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="size-4" /> Add expense
        </Button>
      </PageHeader>

      <ExpensesReadyToBillPanel />

      <Toolbar>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-44">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
          <option value="all">All</option>
          <option value="unbilled">Unbilled</option>
          <option value="billed">Billed</option>
        </Select>
      </Toolbar>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : expenses.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={SearchX}
            title="No matches"
            description="No expenses match your filters."
            action={<Button variant="secondary" onClick={() => { setProjectId(''); setCategory(''); setStatus('all') }}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            description="Track project costs and attach receipts, then add billable ones to an invoice."
            action={<Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="size-4" /> Add expense</Button>}
          />
        )
      ) : (
        <>
          <ExpensesTable
            expenses={expenses}
            onEdit={(e) => { setEditing(e); setFormOpen(true) }}
            onDelete={setToDelete}
            onOpenReceipt={openReceipt}
          />
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm text-fg-muted">
            {totals.byCategory.map((c) => (
              <span key={c.category}>{c.category}: <span className="tabular-nums text-fg">{formatCurrency(c.total, currency)}</span></span>
            ))}
            <span className="font-medium">Total: <span className="tabular-nums text-fg">{formatCurrency(totals.total, currency)}</span></span>
          </div>
        </>
      )}

      {formOpen ? <ExpenseFormModal open onClose={() => setFormOpen(false)} expense={editing} /> : null}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete expense?"
        body="This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={del.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          try {
            await del.mutateAsync(toDelete.id)
            toast.success('Deleted')
            setToDelete(null)
          } catch (e) {
            toast.error(e.userMessage || 'Could not delete')
          }
        }}
      />
    </div>
  )
}
