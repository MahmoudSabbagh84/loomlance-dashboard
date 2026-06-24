// Decide what to do about a paid-plan signup intent, dashboard-side.
//   redirect → first time: send to Stripe Checkout (starts the trial)
//   banner   → already sent once (stripe_customer_id exists) but no subscription → resume prompt
//   none     → Solo/no intent, or already trialing/subscribed
const PAID = new Set(['freelancer', 'studio'])

export function shouldStartTrial(profile, selectedPlan) {
  if (!profile) return 'none'
  if (!PAID.has(selectedPlan)) return 'none'
  const isFree = profile.subscription_tier === 'free' && !profile.stripe_subscription_id
  if (!isFree) return 'none'
  return profile.stripe_customer_id ? 'banner' : 'redirect'
}
