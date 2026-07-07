import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { resetDemoUser } from '@/api/admin'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAppConfig, useUpdateAppConfig } from '@/hooks/useAppConfig'

export default function AdminToolsPage() {
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const { data: config } = useAppConfig()
  const update = useUpdateAppConfig()
  const [banner, setBanner] = useState('')
  useEffect(() => {
    setBanner(config?.maintenance_banner ?? '')
  }, [config?.maintenance_banner])
  const hasActiveBanner = !!config?.maintenance_banner?.trim()
  const dirty = banner.trim() !== (config?.maintenance_banner ?? '').trim() && banner.trim() !== ''

  const onSave = () =>
    update.mutate(
      { maintenance_banner: banner.trim() },
      {
        onSuccess: () => toast.success('Banner saved — it is live now'),
        onError: (e) => toast.error(e.userMessage || e.message),
      }
    )
  const onClear = () => {
    setBanner('')
    update.mutate(
      { maintenance_banner: null },
      {
        onSuccess: () => toast.success('Banner cleared'),
        onError: (e) => toast.error(e.userMessage || e.message),
      }
    )
  }

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
      <AdminTabs />
      <PageHeader title="Tools" />
      <Card>
        <h3 className="font-semibold">Maintenance banner</h3>
        <p className="mt-1 text-sm text-fg-muted">
          Shown across the app and on the sign-in pages while set. Clear it to take it down.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            id="maintenance-banner"
            aria-label="Maintenance banner"
            placeholder="e.g. Payments degraded — investigating"
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
            className="max-w-md"
          />
          <Button onClick={onSave} loading={update.isPending} disabled={!dirty}>
            Save banner
          </Button>
          {hasActiveBanner && (
            <Button variant="secondary" onClick={onClear} loading={update.isPending}>
              Clear
            </Button>
          )}
        </div>
      </Card>
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
