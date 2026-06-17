import { PageHeader } from '@/components/ui/PageHeader'
import { AccountTab } from '@/features/profile/AccountTab'

export default function ProfilePage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Profile" subtitle="Manage your account and business details" />
      <AccountTab />
    </div>
  )
}
