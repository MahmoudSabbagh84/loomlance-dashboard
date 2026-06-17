import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useProfile } from '@/hooks/useProfile'
import { getSplashUpgradeUrl } from '@/lib/tier'

export function SubscriptionTab() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const status = profile?.subscription_status ?? 'active'
  const splashUrl = import.meta.env.VITE_SPLASH_URL || 'https://splash.loomlance.com'

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-fg-muted">Current plan</p>
            <p className="text-xl font-semibold capitalize">{tier.replace('_', ' ')}</p>
            <Badge variant={status === 'active' ? 'success' : 'warning'} className="mt-1 capitalize">
              {status}
            </Badge>
          </div>
          <Button variant="secondary" onClick={() => window.open(`${splashUrl}/billing`, '_blank', 'noopener')}>
            <ExternalLink className="size-4" /> Manage subscription
          </Button>
        </div>
        <p className="mt-3 text-xs text-fg-muted">
          Billing, plan changes, and invoices for your LoomLance subscription are managed on the main site.
        </p>
      </Card>

      {tier === 'free' || tier === 'tier_1' ? (
        <Card className="border-primary/30 bg-primary/5">
          <p className="text-sm">Want more projects, branded invoices, time tracking, expenses, or reports?</p>
          <Button
            className="mt-3"
            onClick={() => window.open(getSplashUpgradeUrl(tier === 'free' ? 'tier_1' : 'tier_2'), '_blank', 'noopener')}
          >
            See plans
          </Button>
        </Card>
      ) : null}
    </div>
  )
}
