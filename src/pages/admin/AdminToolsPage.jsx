import { useState } from 'react'
import { toast } from 'sonner'
import { resetDemoUser } from '@/api/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export default function AdminToolsPage() {
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)

  async function handleReset() {
    setRunning(true)
    try {
      await resetDemoUser()
      toast.success('Demo account reset to the canonical fixture')
      setConfirming(false)
    } catch (e) {
      toast.error(e.userMessage || e.message || 'Reset failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Tools" />
      <Card>
        <h3 className="font-semibold">Reset demo account</h3>
        <p className="mt-1 text-sm text-fg-muted">
          Wipes demo@loomlance.com and re-seeds the screencast fixture (2 clients, 2 projects, 2 invoices, time &
          expenses). Only touches the demo account.
        </p>
        <Button variant="danger" className="mt-4" loading={running} onClick={() => setConfirming(true)}>
          Reset demo account
        </Button>
      </Card>
      <ConfirmDialog
        open={confirming}
        title="Reset demo account?"
        body="All current demo data is replaced with the canonical fixture. This cannot be undone."
        variant="danger"
        loading={running}
        onCancel={() => setConfirming(false)}
        onConfirm={handleReset}
      />
    </div>
  )
}
