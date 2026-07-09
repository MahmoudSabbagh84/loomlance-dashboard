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

// Best-effort ops logging to public.error_logs (Phase 6 admin Ops page) — a logging failure
// must never change this webhook's response or Stripe's retry semantics. Own client because
// the signature-failure path runs before the request-scoped `admin` client exists.
async function logFailure(message: string, context: Record<string, unknown>) {
  try {
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    await svc.from('error_logs').insert({ message: message.slice(0, 500), context })
  } catch (e) {
    console.error('logFailure:', e instanceof Error ? e.message : String(e))
  }
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
    await logFailure('invalid webhook signature', { source: 'subscription-webhook' })
    return new Response('invalid signature', { status: 400 })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // Idempotency: only a unique-violation (23505) means "already processed". Any other insert
  // error is transient → return 500 so Stripe retries (don't silently drop a subscription event).
  const { error: dupErr } = await admin.from('stripe_events').insert({ id: event.id, type: event.type })
  if (dupErr) {
    if (dupErr.code === '23505') return new Response('already processed', { status: 200 })
    await logFailure(`webhook ledger error: ${dupErr.message}`, { source: 'subscription-webhook', eventId: event.id, eventType: event.type })
    return new Response('ledger error', { status: 500 })
  }

  try {
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
          else {
            console.error(`[subscription-webhook] sub ${sub.id}: product ${product?.id} missing metadata.tier — leaving tier unchanged`)
            await logFailure(`sub ${sub.id}: product ${product?.id} missing metadata.tier — tier unchanged`, { source: 'subscription-webhook', eventId: event.id, eventType: event.type })
          }
        } else {
          console.error(`[subscription-webhook] sub ${sub.id}: no price id — leaving tier unchanged`)
          await logFailure(`sub ${sub.id}: no price id — tier unchanged`, { source: 'subscription-webhook', eventId: event.id, eventType: event.type })
        }
      }

      // Stripe API 2024-06-20+ keeps the period end on the subscription ITEM, not the top-level
      // subscription (`sub.current_period_end` is undefined here); during a trial it equals
      // trial_end. Fall through all three so the trial countdown always has a date.
      const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined
      const periodEndUnix =
        (sub as { current_period_end?: number }).current_period_end ??
        item?.current_period_end ??
        sub.trial_end ??
        null

      const patch: Record<string, unknown> = {
        subscription_status: STATUS_MAP[sub.status] ?? 'active',
        stripe_subscription_id: sub.id,
        current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
      }
      // Only touch the tier when we actually resolved one.
      if (tier !== null) patch.subscription_tier = tier

      await admin.from('profiles').update(patch).eq('id', uid)
    }
  }
  } catch (e) {
    // Event ledgered but processing threw. Log + 500 so Stripe retries — same status an
    // unhandled throw produced before, so retry semantics are unchanged.
    await logFailure(e instanceof Error ? e.message : String(e), { source: 'subscription-webhook', eventId: event.id, eventType: event.type })
    return new Response('handler error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
})
