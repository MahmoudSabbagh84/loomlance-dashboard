// stripe-checkout — called UNAUTHENTICATED from the public invoice page. Validates the
// token, then creates a Stripe Checkout Session on the issuer's connected account
// (destination charge, application fee 0) with metadata.invoice_id for the webhook.
//
// Secrets required: STRIPE_SECRET_KEY, PUBLIC_SITE_URL.
// Deploy: supabase functions deploy stripe-checkout --no-verify-jwt
import Stripe from 'npm:stripe@^16'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { token } = await req.json()
    if (!token) return json({ error: 'token required' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const { data: inv } = await admin
      .from('invoices')
      .select('id, invoice_number, currency, status, link_expires_at, user_id')
      .eq('public_token', token)
      .single()
    if (!inv) return json({ error: 'invalid' }, 404)
    if (inv.status === 'paid' || inv.status === 'void') return json({ error: 'not payable' }, 400)
    if (inv.link_expires_at && new Date(inv.link_expires_at) < new Date()) return json({ error: 'expired' }, 400)

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_connect_account_id')
      .eq('id', inv.user_id)
      .single()
    const destination = profile?.stripe_connect_account_id
    if (!destination || destination === 'mock_connect') return json({ error: 'not connected' }, 400)

    const { data: items } = await admin
      .from('invoice_line_items')
      .select('description, quantity, unit_price, tax_rate, discount_rate')
      .eq('invoice_id', inv.id)

    const lineItems = (items ?? []).map((li) => {
      const net = Number(li.unit_price) * (1 - Number(li.discount_rate) / 100)
      const withTax = net * (1 + Number(li.tax_rate) / 100)
      return {
        price_data: {
          currency: String(inv.currency).toLowerCase(),
          product_data: { name: li.description || 'Item' },
          unit_amount: Math.round(withTax * 100),
        },
        quantity: Number(li.quantity),
      }
    })

    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${siteUrl}/i/${token}?paid=1`,
      cancel_url: `${siteUrl}/i/${token}`,
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: { destination },
      },
      metadata: { invoice_id: inv.id },
    })
    return json({ url: session.url })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
