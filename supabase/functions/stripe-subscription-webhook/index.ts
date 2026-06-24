// stripe-subscription-webhook — UNAUTHENTICATED (the Stripe signature is the auth). Maps
// subscription lifecycle events to profiles.subscription_tier / subscription_status. The tier
// is derived from the subscription's product metadata (tier = 'tier_1' | 'tier_2'), so it's
// price-id-agnostic. Idempotent via the stripe_events ledger.
//
// This is SEPARATE from stripe-webhook (which handles Connect invoice payments). Register this
// endpoint for: customer.subscription.created, .updated, .deleted.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_SUBSCRIPTION_WEBHOOK_SECRET.
// Deploy: supabase functions deploy stripe-subscription-webhook --no-verify-jwt
import Stripe from 'npm:stripe@^16'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' })

// Stripe subscription.status -> our subscription_status enum
// ('active','past_due','canceled','incomplete','trialing')
const STATUS_MAP: Record<string, string> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  paused: 'canceled',
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const bodyText = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      bodyText,
      signature ?? '',
      Deno.env.get('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET') ?? '',
    )
  } catch {
    return new Response('invalid signature', { status: 400 })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // Idempotency: first insert wins; duplicate event id is a no-op.
  const { error: dupErr } = await admin.from('stripe_events').insert({ id: event.id, type: event.type })
  if (dupErr) return new Response('already processed', { status: 200 })

  if (event.type.startsWith('customer.subscription.')) {
    const sub = event.data.object as Stripe.Subscription

    // Resolve the LoomLance user: prefer metadata, fall back to the customer mapping.
    let uid = sub.metadata?.user_id as string | undefined
    if (!uid) {
      const { data } = await admin.from('profiles').select('id').eq('stripe_customer_id', sub.customer as string).single()
      uid = data?.id
    }

    if (uid) {
      const canceled = sub.status === 'canceled'
      // Derive tier from the product metadata (set tier=tier_1 / tier_2 on each Stripe
      // Product). null = couldn't resolve → leave subscription_tier UNCHANGED. Defaulting
      // a live paying subscription to 'free' on a metadata misconfig would silently
      // downgrade the customer.
      let tier: string | null = canceled ? 'free' : null
      if (!canceled) {
        const priceId = sub.items?.data?.[0]?.price?.id
        if (priceId) {
          const price = await stripe.prices.retrieve(priceId, { expand: ['product'] })
          const product = price.product as Stripe.Product
          const metaTier = product?.metadata?.tier as string | undefined
          if (metaTier) tier = metaTier
          else console.error(`[subscription-webhook] sub ${sub.id}: product ${product?.id} missing metadata.tier — leaving tier unchanged`)
        } else {
          console.error(`[subscription-webhook] sub ${sub.id}: no price id — leaving tier unchanged`)
        }
      }

      const patch: Record<string, unknown> = {
        subscription_status: STATUS_MAP[sub.status] ?? 'active',
        stripe_subscription_id: sub.id,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
      }
      // Only touch the tier when we actually resolved one.
      if (tier !== null) patch.subscription_tier = tier

      await admin.from('profiles').update(patch).eq('id', uid)
    }
  }

  return new Response('ok', { status: 200 })
})
