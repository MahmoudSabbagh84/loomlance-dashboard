// stripe-disconnect — authenticated. Unlinks the caller's Stripe Connect account by clearing
// profiles.stripe_connect_account_id. Must run server-side with the service role because that
// column is trigger-protected (protect_billing_columns) from end-user writes.
//
// Unlink-only: the Stripe Express account itself is left intact (avoids balance/payout edge
// cases). This just stops LoomLance routing card payments to it — the public invoice page's
// can_pay flips false, so the card button disappears and invoices fall back to instructions.
//
// Secrets required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Deploy: supabase functions deploy stripe-disconnect
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'

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
    const { error } = await admin.from('profiles').update({ stripe_connect_account_id: null }).eq('id', user.id)
    if (error) return json({ error: error.message }, 500)

    return json({ disconnected: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
