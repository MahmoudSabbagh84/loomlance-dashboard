import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { AccountTab } from '@/features/profile/AccountTab'
import { BusinessTab } from '@/features/profile/BusinessTab'
import { SubscriptionTab } from '@/features/profile/SubscriptionTab'

const TABS = [
  { key: 'account', label: 'Account' },
  { key: 'business', label: 'Business' },
  { key: 'subscription', label: 'Subscription' },
]

export default function ProfilePage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'account')

  return (
    <div className="space-y-5">
      <PageHeader title="Profile" subtitle="Account, business, and subscription" />
      <Tabs value={tab} onChange={setTab} items={TABS} />
      <div className="pt-1">
        {tab === 'account' && <AccountTab />}
        {tab === 'business' && <BusinessTab />}
        {tab === 'subscription' && <SubscriptionTab />}
      </div>
    </div>
  )
}
