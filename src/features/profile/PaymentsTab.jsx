import { useState } from 'react'
import { CreditCard, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { invokeEdge } from '@/api/edge'
import { paymentsAreReal } from '@/lib/providers'

export function PaymentsTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const [connecting, setConnecting] = useState(false)
  const connected = !!profile?.stripe_connect_account_id && profile.stripe_connect_account_id !== 'mock_connect'
  const mockConnected = profile?.stripe_connect_account_id === 'mock_connect'

  const connectReal = async () => {
    setConnecting(true)
    try {
      const { url } = await invokeEdge('stripe-connect', {})
      window.location.href = url
    } catch (e) {
      toast.error(e.userMessage || 'Could not start Stripe onboarding')
      setConnecting(false)
    }
  }

  const toggle = async (next) => {
    try {
      await update.mutateAsync({ stripe_connect_account_id: next ? 'mock_connect' : null })
      toast.success(next ? 'Stripe connected (simulated)' : 'Stripe disconnected')
    } catch (e) {
      toast.error(e.userMessage || 'Could not update')
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              <h3 className="text-sm font-semibold">Online payments</h3>
              {connected || mockConnected ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="size-3" /> {mockConnected ? 'Connected (simulated)' : 'Connected'}
                </Badge>
              ) : (
                <Badge>Not connected</Badge>
              )}
            </div>
            <p className="mt-2 text-sm text-fg-muted">
              When connected, your invoices show a “Pay now” button so clients can pay you online.
            </p>
          </div>
        </div>
        {paymentsAreReal ? (
          <Button onClick={connectReal} loading={connecting}>
            {connected ? 'Manage Stripe account' : 'Connect Stripe'}
          </Button>
        ) : (
          <>
            <p className="rounded-md bg-bg-muted px-3 py-2 text-xs text-fg-muted">
              This is a simulated connection. Real Stripe Connect onboarding and live payments are enabled by setting
              <code className="mx-1">VITE_PAYMENTS_PROVIDER=stripe</code> (see pre-production.md).
            </p>
            {mockConnected ? (
              <Button variant="secondary" onClick={() => toggle(false)} loading={update.isPending}>
                Disconnect
              </Button>
            ) : (
              <Button onClick={() => toggle(true)} loading={update.isPending}>
                Connect Stripe (simulated)
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
