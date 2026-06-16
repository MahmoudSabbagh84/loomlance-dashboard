import { useState } from 'react'
import { Lock } from 'lucide-react'
import { hasFeature } from '@/lib/tier'
import { UpgradeDialog } from './UpgradeDialog'
import { useProfile } from '@/hooks/useProfile'

/**
 * variant:
 *   "nav"     - render the child as-is but with a lock indicator; click opens UpgradeDialog
 *   "action"  - render children normally; expose a check function via children-as-function pattern
 *   "inline"  - render disabled placeholder with a "Tier X feature" pill
 */
export function TierGate({ feature, variant = 'inline', target = 'tier_1', children, fallback }) {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [open, setOpen] = useState(false)

  if (hasFeature(tier, feature)) return children

  if (variant === 'nav') {
    return (
      <>
        <button onClick={() => setOpen(true)} className="w-full text-left">
          {typeof children === 'function' ? children({ locked: true }) : children}
        </button>
        <UpgradeDialog open={open} onClose={() => setOpen(false)} feature={feature} currentTier={tier} target={target} />
      </>
    )
  }

  if (variant === 'action') {
    return typeof children === 'function' ? children({ locked: true, openUpgrade: () => setOpen(true) }) : null
  }

  // inline
  if (fallback) return fallback
  return (
    <div className="rounded-md border border-dashed border-border bg-bg-muted/40 p-4 text-center text-sm text-fg-muted">
      <Lock className="size-4 inline mr-1.5 -mt-0.5" />
      Available on {target.replace('_', ' ')}. <button className="text-primary underline" onClick={() => setOpen(true)}>Learn more</button>
      <UpgradeDialog open={open} onClose={() => setOpen(false)} feature={feature} currentTier={tier} target={target} />
    </div>
  )
}
