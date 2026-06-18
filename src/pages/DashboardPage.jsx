import { PageHeader } from '@/components/ui/PageHeader'
import { useProfile } from '@/hooks/useProfile'
import { formatDate } from '@/lib/date'
import { StatsRow } from '@/features/dashboard/StatsRow'
import { DueSoonPanel } from '@/features/dashboard/DueSoonPanel'
import { RecentActivity } from '@/features/dashboard/RecentActivity'
import { OnboardingChecklist } from '@/features/dashboard/OnboardingChecklist'
import { DashboardInsights } from '@/features/dashboard/DashboardInsights'

function greetingFor(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const { data: profile } = useProfile()
  const name = profile?.display_name || 'there'
  const greeting = greetingFor(new Date().getHours())

  return (
    <div className="space-y-5">
      <PageHeader title={`${greeting}, ${name}`} subtitle={formatDate(new Date(), 'EEEE, MMMM d, yyyy')} />
      <OnboardingChecklist />
      <StatsRow />
      <DashboardInsights />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DueSoonPanel />
        </div>
        <div>
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}
