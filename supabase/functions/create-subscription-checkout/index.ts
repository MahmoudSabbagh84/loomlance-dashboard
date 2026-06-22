// create-subscription-checkout — authenticated. Creates (or reuses) a Stripe Customer for the
// caller and starts a SUBSCRIPTION Checkout Session with a 14-day trial for the chosen plan.
// This is LoomLance's own platform billing (charging the freelancer) — distinct from the
// Stripe Connect flow (clients paying the freelancer's invoices).
//
// Body: { plan: 'freelancer' | 'studio', period: 'monthly' | 'annual' }
// Price IDs come from env (not hardcoded); the webhook derives the tier from the product's
// metadata.tier, so this stays price-id-agnostic for mapping.
//
// Secrets: STRIPE_SECRET_KEY, PUBLIC_SITE_URL,
//   STRIPE_PRICE_FREELANCER_MONTHLY, STRIPE_PRICE_FREELANCER_ANNUAL,
//   STRIPE_PRICE_STUDIO_MONTHLY, STRIPE_PRICE_STUDIO_ANNUAL
// Deploy: supabase functions deploy create-subscription-checkout
import Stripe from 'npm:stripe@^16'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { plan, period } = await req.json()
    const key = `STRIPE_PRICE_${String(plan || '').toUpperCase()}_${String(period || '').toUpperCase()}`
    const priceId = Deno.env.get(key)
    if (!priceId) return json({ error: 'Unknown plan/period' }, 400)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, business_name')
      .eq('id', user.id)
      .single()

    // One Stripe Customer per user (reused across upgrades).
    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.business_name || undefined,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 14, metadata: { user_id: user.id } },
      success_url: `${siteUrl}/profile?tab=subscription&upgraded=1`,
      cancel_url: `${siteUrl}/profile?tab=subscription`,
      metadata: { user_id: user.id },
      allow_promotion_codes: true,
    })
    return json({ url: session.url })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
