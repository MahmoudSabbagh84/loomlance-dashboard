// stripe-connect — creates (or reuses) a Stripe Connect Express account for the
// caller and returns an onboarding account-link URL. Authenticated.
//
// Secrets required: STRIPE_SECRET_KEY, PUBLIC_SITE_URL.
// Deploy: supabase functions deploy stripe-connect
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
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_connect_account_id')
      .eq('id', user.id)
      .single()

    let accountId = profile?.stripe_connect_account_id
    // Treat the dev sentinel as "no real account".
    if (!accountId || accountId === 'mock_connect') {
      const account = await stripe.accounts.create({ type: 'express', metadata: { user_id: user.id } })
      accountId = account.id
      await admin.from('profiles').update({ stripe_connect_account_id: accountId }).eq('id', user.id)
    }

    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/profile?tab=payments`,
      return_url: `${siteUrl}/profile?tab=payments&connected=1`,
      type: 'account_onboarding',
    })
    return json({ url: accountLink.url })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
