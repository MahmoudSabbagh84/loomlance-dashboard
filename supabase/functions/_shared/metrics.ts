// supabase/functions/_shared/metrics.ts — pure Stripe metric math for admin-metrics.
// No I/O so it is unit-testable from vitest. Definitions pinned by the Business Pulse spec:
// MRR counts active + past_due; trials churn only when they end without ever converting.

type StripeItem = {
  quantity?: number
  price?: { unit_amount?: number | null; currency?: string; recurring?: { interval?: string; interval_count?: number } | null }
}
type StripeSub = {
  status?: string
  items?: { data?: StripeItem[] }
  trial_end?: number | null
  ended_at?: number | null
}

export function monthlyAmountCents(item?: StripeItem): number {
  const price = item?.price
  if (!price?.unit_amount || !price.recurring?.interval) return 0
  const per = (price.unit_amount * (item?.quantity ?? 1)) / (price.recurring.interval_count || 1)
  switch (price.recurring.interval) {
    case 'month': return per
    case 'year': return per / 12
    case 'week': return (per * 52) / 12
    case 'day': return (per * 365) / 12
    default: return 0
  }
}

export function computeStripeMetrics(subs: StripeSub[]) {
  let mrr = 0
  let activeSubs = 0
  let trialing = 0
  let trialsConverted = 0
  let trialsChurned = 0
  let currency = 'usd'
  for (const s of subs) {
    const items = s.items?.data ?? []
    const c = items[0]?.price?.currency
    if (c) currency = c
    const hadTrial = s.trial_end != null
    if (s.status === 'active' || s.status === 'past_due') {
      activeSubs++
      for (const it of items) mrr += monthlyAmountCents(it)
      if (hadTrial) trialsConverted++
    } else if (s.status === 'trialing') {
      trialing++
    } else if (hadTrial && (s.status === 'canceled' || s.status === 'incomplete_expired')) {
      if (s.ended_at != null && s.trial_end != null && s.ended_at <= s.trial_end) trialsChurned++
    }
  }
  return { mrr: Math.round(mrr), currency, activeSubs, trialing, trialsConverted, trialsChurned }
}
