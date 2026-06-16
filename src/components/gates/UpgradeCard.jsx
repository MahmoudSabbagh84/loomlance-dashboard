import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { UPGRADE_COPY, getSplashUpgradeUrl } from '@/lib/tier'

export function UpgradeCard({ feature, currentTier = 'free', target = 'tier_1', onDismiss }) {
  const copy = UPGRADE_COPY[feature]
  if (!copy) return null
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2">
          <Lock className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{copy.title}</h3>
          <p className="mt-1 text-sm text-fg-muted">{copy.body(currentTier)}</p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => window.open(getSplashUpgradeUrl(target), '_blank')}>
              See plans
            </Button>
            {onDismiss ? (
              <Button variant="ghost" onClick={onDismiss}>
                Maybe later
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
