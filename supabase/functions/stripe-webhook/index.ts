// stripe-webhook — receives Stripe events (UNAUTHENTICATED; the signature IS the auth).
// Handles checkout.session.completed: records the payment, marks the invoice paid, notifies.
// Idempotent via the stripe_events ledger. This REPLACES mock_pay_invoice in production.
//
// Secrets required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Then register the function URL in Stripe → Webhooks for `checkout.session.completed`.
import Stripe from 'npm:stripe@^16'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' })

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const bodyText = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(bodyText, signature ?? '', Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '')
  } catch {
    return new Response('invalid signature', { status: 400 })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // Idempotency: first insert wins; a duplicate event id is a no-op.
  const { error: dupErr } = await admin.from('stripe_events').insert({ id: event.id, type: event.type })
  if (dupErr) return new Response('already processed', { status: 200 })

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const invoiceId = session.metadata?.invoice_id
    if (invoiceId) {
      const { data: inv } = await admin
        .from('invoices')
        .select('id, user_id, invoice_number, currency, status')
        .eq('id', invoiceId)
        .single()
      if (inv && inv.status !== 'paid') {
        const amount = (session.amount_total ?? 0) / 100
        await admin.from('invoice_payments').insert({
          user_id: inv.user_id,
          invoice_id: inv.id,
          amount,
          currency: inv.currency,
          method: 'stripe',
          stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        })
        await admin.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', inv.id)
        await admin.from('user_notifications').insert({
          user_id: inv.user_id,
          kind: 'invoice_paid',
          payload: { title: `Invoice ${inv.invoice_number} was paid`, body: `${inv.currency} ${amount.toFixed(2)} received` },
          link_to: `/invoices/${inv.id}`,
        })
      }
    }
  }

  return new Response('ok', { status: 200 })
})
