import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useProfile } from '@/hooks/useProfile'
import { useBilling } from '@/hooks/useBilling'
import { formatDate } from '@/lib/date'
import { TrialCountdown } from '@/features/subscription/TrialCountdown'

// Display prices mirror the Stripe Prices (see the pricing spec). The actual charge comes from
// Stripe; the plan/period is mapped to a price ID in the create-subscription-checkout function.
const PLANS = [
  { id: 'freelancer', tier: 'tier_1', name: 'Freelancer', monthly: 19, annual: 190, blurb: '5 projects · branding · recurring · time tracking' },
  { id: 'studio', tier: 'tier_2', name: 'Studio', monthly: 49, annual: 490, blurb: 'Unlimited projects · expenses · reports' },
]
const RANK = { free: 0, tier_1: 1, tier_2: 2 }
const TIER_NAME = { free: 'Solo (Free)', tier_1: 'Freelancer', tier_2: 'Studio' }

export function SubscriptionTab() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const status = profile?.subscription_status ?? 'active'
  const hasCustomer = !!profile?.stripe_customer_id
  const periodEnd = profile?.current_period_end
  const [period, setPeriod] = useState('monthly')
  const { loading, startCheckout, openPortal } = useBilling()

  // After returning from Checkout (?upgraded=1) the subscription webhook is async, so poll the
  // profile for a few seconds until the new plan/status shows.
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [finalizing, setFinalizing] = useState(params.get('upgraded') === '1')
  useEffect(() => {
    if (params.get('upgraded') !== '1') return undefined
    let tries = 0
    const id = setInterval(() => {
      tries += 1
      qc.invalidateQueries({ queryKey: ['profile'] })
      if (tries >= 6) {
        clearInterval(id)
        setFinalizing(false)
      }
    }, 2000)
    return () => clearInterval(id)
  }, [params, qc])
  useEffect(() => {
    if (finalizing && tier !== 'free') setFinalizing(false)
  }, [finalizing, tier])

  const periodLabel = status === 'canceled' ? 'Access until' : 'Renews'

  return (
    <div className="max-w-2xl space-y-4">
      {finalizing ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-fg">
          <Loader2 className="size-4 animate-spin text-primary" /> Finalizing your subscription — this can take a few seconds…
        </div>
      ) : null}

      {/* Current plan */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-fg-muted">Current plan</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold">{TIER_NAME[tier] ?? tier}</p>
              {status === 'trialing' ? (
                <Badge variant="primary" className="gap-1">
                  <Sparkles className="size-3" aria-hidden /> Trial
                </Badge>
              ) : status !== 'active' ? (
                <Badge variant="warning" className="capitalize">{status}</Badge>
              ) : null}
            </div>
            {status !== 'trialing' && periodEnd ? (
              <p className="mt-2 text-xs text-fg-muted">{periodLabel} {formatDate(periodEnd)}</p>
            ) : null}
          </div>
          {hasCustomer ? (
            <Button variant="secondary" onClick={openPortal} loading={loading === 'portal'}>
              <ExternalLink className="size-4" /> Manage billing
            </Button>
          ) : null}
        </div>
        {status === 'trialing' && periodEnd ? (
          <TrialCountdown endsAt={periodEnd} planName={TIER_NAME[tier] ?? tier} />
        ) : null}
        {tier === 'free' ? (
          <p className="mt-3 text-xs text-fg-muted">
            You’re on the free Solo plan. Start a 14-day trial of a paid plan below — card required, cancel anytime before it ends.
          </p>
        ) : null}
      </Card>

      {/* Upgrade / choose a plan (only when there's a higher tier to move to) */}
      {RANK[tier] < 2 ? (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{tier === 'free' ? 'Choose a plan' : 'Upgrade'}</h3>
            <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
              {['monthly', 'annual'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded px-2.5 py-1 capitalize transition-colors ${period === p ? 'bg-bg-muted font-medium text-fg' : 'text-fg-muted hover:text-fg'}`}
                >
                  {p === 'annual' ? 'Annual · 2 mo free' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const isCurrent = plan.tier === tier
              const isUpgrade = RANK[plan.tier] > RANK[tier]
              const price = period === 'annual' ? plan.annual : plan.monthly
              return (
                <div key={plan.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{plan.name}</p>
                    {isCurrent ? <Badge variant="success">Current</Badge> : null}
                  </div>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    ${price}
                    <span className="text-sm font-normal text-fg-muted">/{period === 'annual' ? 'yr' : 'mo'}</span>
                  </p>
                  <p className="mt-1 text-xs text-fg-muted">{plan.blurb}</p>
                  {isUpgrade ? (
                    <Button
                      className="mt-3 w-full"
                      onClick={() => startCheckout(plan.id, period)}
                      loading={loading === `${plan.id}:${period}`}
                    >
                      Start 14-day trial
                    </Button>
                  ) : isCurrent ? (
                    <Button className="mt-3 w-full" variant="secondary" disabled>Current plan</Button>
                  ) : (
                    <Button className="mt-3 w-full" variant="ghost" onClick={openPortal} loading={loading === 'portal'}>
                      Manage
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-fg-muted">
            Plan changes and cancellations are handled in the billing portal (Manage billing).
          </p>
        </Card>
      ) : null}
    </div>
  )
}
