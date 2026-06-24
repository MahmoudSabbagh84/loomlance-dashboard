import { useEffect, useRef, useState } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useUser } from '@/hooks/useAuth'
import { useBilling } from '@/hooks/useBilling'
import { shouldStartTrial } from '@/lib/trial'
import { TrialResumeBanner } from './TrialResumeBanner'

const PLAN_NAMES = { freelancer: 'Freelancer', studio: 'Studio' }
const DISMISS_KEY = 'loomlance.trialBannerDismissed'

// Bridges the splash signup intent to a started trial: on first authenticated load, a paid
// signup is sent to Stripe Checkout; if they bailed (stripe_customer_id set, no subscription)
// they get a dismissible resume banner instead of being looped back to Stripe.
export function TrialBootstrap() {
  const { user } = useUser()
  const { data: profile } = useProfile()
  const { startCheckout } = useBilling()
  const fired = useRef(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true'
    } catch {
      return false
    }
  })

  const plan = user?.user_metadata?.selected_plan
  const period = user?.user_metadata?.selected_period || 'monthly'
  const action = profile ? shouldStartTrial(profile, plan) : 'none'

  useEffect(() => {
    if (action === 'redirect' && !fired.current) {
      fired.current = true // guard StrictMode double-invoke; the redirect navigates away anyway
      startCheckout(plan, period)
    }
  }, [action, plan, period, startCheckout])

  if (action !== 'banner' || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      /* private mode — in-memory only */
    }
    setDismissed(true)
  }

  return (
    <TrialResumeBanner
      planName={PLAN_NAMES[plan] || 'paid'}
      onResume={() => startCheckout(plan, period)}
      onDismiss={dismiss}
    />
  )
}
