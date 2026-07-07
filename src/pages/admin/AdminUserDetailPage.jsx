import { AdminTabs } from '@/features/admin/AdminTabs'
import { PageHeader } from '@/components/ui/PageHeader'

export default function AdminUserDetailPage() {
  return (
    <div className="space-y-5">
      <AdminTabs />
      <PageHeader title="User" />
    </div>
  )
}
