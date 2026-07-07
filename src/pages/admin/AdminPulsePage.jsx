import { PageHeader } from '@/components/ui/PageHeader'
import { AdminTabs } from '@/features/admin/AdminTabs'

export default function AdminPulsePage() {
  return (
    <div className="space-y-5">
      <AdminTabs />
      <PageHeader title="Pulse" />
    </div>
  )
}
