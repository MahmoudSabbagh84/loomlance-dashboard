// create-billing-portal — authenticated. Returns a Stripe Billing Portal URL so the user can
// self-serve: change/cancel plan, update card, view invoices. Requires an existing customer
// (i.e. they've subscribed at least once).
//
// Secrets: STRIPE_SECRET_KEY, PUBLIC_SITE_URL.
// Deploy: supabase functions deploy create-billing-portal
import Stripe from 'npm:stripe@^16'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' })

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  try {
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
    const { data: profile } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
    if (!profile?.stripe_customer_id) return json({ error: 'No subscription yet' }, 400)

    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''
    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${siteUrl}/profile?tab=subscription`,
    })
    return json({ url: portal.url })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
