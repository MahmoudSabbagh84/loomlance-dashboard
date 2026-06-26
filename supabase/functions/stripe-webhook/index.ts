// stripe-webhook — receives Stripe Connect events (UNAUTHENTICATED; the signature IS the auth).
//   checkout.session.completed         → validate amount, record payment, mark paid, notify
//   checkout.session.async_payment_failed → notify (do NOT mark paid)
//   charge.refunded / charge.dispute.created → notify the freelancer
// Idempotent via the stripe_events ledger (unique-violation only). REPLACES mock_pay_invoice in prod.
//
// Secrets required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Register in Stripe → Webhooks for: checkout.session.completed,
//   checkout.session.async_payment_failed, charge.refunded, charge.dispute.created.
import Stripe from 'npm:stripe@^16'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { invoiceTotals } from '../_shared/money.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' })

// Same basis as stripe-checkout: round(invoiceTotals(items).total * 100).
// Using the shared helper guarantees reconciliation can never drift from what was charged.
const expectedAmountCents = (items: any[]) => Math.round(invoiceTotals(items ?? []).total * 100)

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

  const notify = (userId: string, kind: string, title: string, body: string, link: string) =>
    admin.from('user_notifications').insert({ user_id: userId, kind, payload: { title, body }, link_to: link })

  // Idempotency: only a unique-violation (23505) means "already processed". Any other insert
  // error is transient → return 500 so Stripe retries (never silently drop a payment event).
  const { error: dupErr } = await admin.from('stripe_events').insert({ id: event.id, type: event.type })
  if (dupErr) {
    if (dupErr.code === '23505') return new Response('already processed', { status: 200 })
    return new Response('ledger error', { status: 500 })
  }

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
        const { data: items } = await admin
          .from('invoice_line_items')
          .select('quantity, unit_price, tax_rate, discount_rate')
          .eq('invoice_id', inv.id)
        const expected = expectedAmountCents(items ?? [])
        const paidCents = session.amount_total ?? 0
        const amount = paidCents / 100

        if (paidCents < expected) {
          // Underpaid / mismatched — do NOT mark paid; flag it for the freelancer.
          await notify(
            inv.user_id,
            'invoice_payment_mismatch',
            `Invoice ${inv.invoice_number}: payment didn't match`,
            `Received ${inv.currency} ${amount.toFixed(2)}, expected ${inv.currency} ${(expected / 100).toFixed(2)}. Not marked paid.`,
            `/invoices/${inv.id}`,
          )
        } else {
          await admin.from('invoice_payments').insert({
            user_id: inv.user_id,
            invoice_id: inv.id,
            amount,
            currency: inv.currency,
            method: 'stripe',
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          })
          await admin.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', inv.id)
          await notify(
            inv.user_id,
            'invoice_paid',
            `Invoice ${inv.invoice_number} was paid`,
            `${inv.currency} ${amount.toFixed(2)} received`,
            `/invoices/${inv.id}`,
          )
        }
      }
    }
  } else if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session
    const invoiceId = session.metadata?.invoice_id
    if (invoiceId) {
      const { data: inv } = await admin.from('invoices').select('id, user_id, invoice_number').eq('id', invoiceId).single()
      if (inv) {
        await notify(
          inv.user_id,
          'invoice_payment_failed',
          `Invoice ${inv.invoice_number}: payment failed`,
          'The payment did not go through; the invoice was not marked paid.',
          `/invoices/${inv.id}`,
        )
      }
    }
  } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    // Map the charge back to our payment via the payment intent, then notify the freelancer.
    const obj = event.data.object as { payment_intent?: string }
    const pi = typeof obj.payment_intent === 'string' ? obj.payment_intent : null
    if (pi) {
      const { data: pay } = await admin
        .from('invoice_payments')
        .select('invoice_id, user_id, invoices(invoice_number)')
        .eq('stripe_payment_intent_id', pi)
        .single()
      if (pay) {
        const num = (pay.invoices as { invoice_number?: string } | null)?.invoice_number ?? ''
        const refunded = event.type === 'charge.refunded'
        await notify(
          pay.user_id,
          refunded ? 'invoice_refunded' : 'invoice_disputed',
          refunded ? `Invoice ${num}: payment refunded` : `Invoice ${num}: payment disputed`,
          refunded
            ? "A refund was issued — review this invoice's status."
            : 'A client opened a dispute — respond from your Stripe dashboard.',
          `/invoices/${pay.invoice_id}`,
        )
      }
    }
  }

  return new Response('ok', { status: 200 })
})
