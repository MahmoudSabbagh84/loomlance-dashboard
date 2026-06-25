import { useEffect, useRef, useState } from 'react'
import { CreditCard, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { invokeEdge } from '@/api/edge'
import { paymentsAreReal } from '@/lib/providers'

// Payment instructions autosave (debounced) — no manual Save.
function DefaultInstructionsCard({ profile, update }) {
  const [value, setValue] = useState(profile.default_payment_instructions || '')
  const [status, setStatus] = useState('idle')
  const timer = useRef(null)
  const idle = useRef(null)

  const save = async (v) => {
    setStatus('saving')
    try {
      await update.mutateAsync({ default_payment_instructions: v })
      setStatus('saved')
      clearTimeout(idle.current)
      idle.current = setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
    }
  }
  const onChange = (v) => {
    setValue(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save(v), 700)
  }
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(idle.current) }, [])

  return (
    <Card className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">Payment instructions</h3>
        <p className="mt-0.5 text-sm text-fg-muted">
          Added to every new invoice — bank details, a preferred method, or anything clients need to pay you.
        </p>
      </div>
      <Label htmlFor="pay-instructions">Default payment instructions</Label>
      <Textarea
        id="pay-instructions"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Bank transfer to IBAN … · or pay cash on delivery"
      />
      <div className="flex h-5 justify-end">
        <SaveStatus status={status} onRetry={() => save(value)} />
      </div>
    </Card>
  )
}

// PayPal.me link autosave (debounced) — invoices render a "Pay with PayPal" button.
function PayPalLinkCard({ profile, update }) {
  const [value, setValue] = useState(profile.paypal_link || '')
  const [status, setStatus] = useState('idle')
  const timer = useRef(null)
  const idle = useRef(null)

  const save = async (v) => {
    setStatus('saving')
    try {
      await update.mutateAsync({ paypal_link: v.trim() || null })
      setStatus('saved')
      clearTimeout(idle.current)
      idle.current = setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
    }
  }
  const onChange = (v) => {
    setValue(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save(v), 700)
  }
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(idle.current) }, [])

  return (
    <Card className="space-y-2">
      <h3 className="text-sm font-semibold">PayPal</h3>
      <p className="text-sm text-fg-muted">
        Add your PayPal.me link or username — invoices show a &ldquo;Pay with PayPal&rdquo; button. There&apos;s no auto-reconcile, so
        you confirm receipt with <span className="font-medium">Mark as paid</span>.
      </p>
      <Label htmlFor="paypal-link">PayPal.me link or username</Label>
      <Input
        id="paypal-link"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="paypal.me/yourname  ·  or just yourname"
      />
      <div className="flex h-5 justify-end">
        <SaveStatus status={status} onRetry={() => save(value)} />
      </div>
    </Card>
  )
}

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

  const toggleStripe = async (next) => {
    try {
      await update.mutateAsync({ stripe_connect_account_id: next ? 'mock_connect' : null })
      toast.success(next ? 'Stripe connected (simulated)' : 'Stripe disconnected')
    } catch (e) {
      toast.error(e.userMessage || 'Could not update')
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h2 className="text-sm font-semibold">How clients can pay you</h2>
        <p className="mt-0.5 text-sm text-fg-muted">
          Clients always see your payment instructions. Connect Stripe or PayPal to also let them pay online — they choose how.
        </p>
      </div>

      {/* Payment instructions — the universal cash/bank baseline, prefilled onto new invoices. */}
      {profile ? <DefaultInstructionsCard key={profile.id} profile={profile} update={update} /> : null}

      {/* Stripe (card payments) — always live; connect/disconnect is the switch. */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          <h3 className="text-sm font-semibold">Stripe (card payments)</h3>
          {connected || mockConnected ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="size-3" /> {mockConnected ? 'Connected (simulated)' : 'Connected'}
            </Badge>
          ) : (
            <Badge>Not connected</Badge>
          )}
        </div>
        <p className="text-sm text-fg-muted">Connect Stripe so clients can pay invoices by card. Available in Stripe-supported countries.</p>
        {paymentsAreReal ? (
          <Button onClick={connectReal} loading={connecting}>
            {connected ? 'Manage Stripe account' : 'Connect Stripe'}
          </Button>
        ) : mockConnected ? (
          <Button variant="secondary" onClick={() => toggleStripe(false)} loading={update.isPending}>Disconnect</Button>
        ) : (
          <Button onClick={() => toggleStripe(true)} loading={update.isPending}>Connect Stripe (simulated)</Button>
        )}
      </Card>

      {/* PayPal (link MVP) — always live. */}
      {profile ? <PayPalLinkCard key={profile.id} profile={profile} update={update} /> : null}
    </div>
  )
}
