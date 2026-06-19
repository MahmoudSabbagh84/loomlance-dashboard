import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Repeat, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile } from '@/hooks/useProfile'
import {
  useRecurringTemplates,
  useDeleteTemplate,
  useSetTemplateActive,
  useGenerateNow,
} from '@/hooks/useRecurringTemplates'
import { hasFeature, FEATURES } from '@/lib/tier'
import { RecurringTemplatesTable } from '@/features/recurring/RecurringTemplatesTable'
import { RecurringTemplateFormModal } from '@/features/recurring/RecurringTemplateFormModal'

export default function RecurringInvoicesPage() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const { data: templates = [], isLoading } = useRecurringTemplates()
  const del = useDeleteTemplate()
  const setActive = useSetTemplateActive()
  const gen = useGenerateNow()

  if (!hasFeature(tier, FEATURES.RECURRING_INVOICES)) {
    return (
      <div className="space-y-5">
        <PageHeader title="Recurring invoices" />
        <UpgradeCard feature={FEATURES.RECURRING_INVOICES} currentTier={tier} target="tier_1" />
      </div>
    )
  }

  const onGenerate = async (t) => {
    try {
      const id = await gen.mutateAsync(t.id)
      toast.success('Draft invoice created')
      navigate(`/invoices/${id}`)
    } catch (e) {
      toast.error(e.userMessage || 'Could not generate invoice')
    }
  }

  const onToggleActive = async (t) => {
    try {
      await setActive.mutateAsync({ id: t.id, active: !t.active })
      toast.success(t.active ? 'Paused' : 'Resumed')
    } catch (e) {
      toast.error(e.userMessage || 'Could not update')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Recurring invoices" subtitle="Templates that bill on a schedule">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="size-4" /> Invoices
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="size-4" /> New template
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring templates"
          description="Create a template to auto-generate draft invoices on a schedule."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> New template</Button>}
        />
      ) : (
        <RecurringTemplatesTable
          templates={templates}
          onGenerate={onGenerate}
          onToggleActive={onToggleActive}
          onEdit={(t) => { setEditing(t); setFormOpen(true) }}
          onDelete={setToDelete}
        />
      )}

      {formOpen ? <RecurringTemplateFormModal open onClose={() => setFormOpen(false)} template={editing} /> : null}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete template?"
        body="This stops future invoices from this template. Already-generated invoices are kept."
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
