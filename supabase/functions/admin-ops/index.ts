// admin-ops — authenticated, admin-only. "Is the machinery working?" feeds for /admin/ops:
// pg_cron health (admin_cron_health RPC), Stripe webhook activity + failures, email send
// failures, and client errors — all read-only. Deploy: supabase functions deploy admin-ops
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'

const EMAIL_SOURCE = 'send-invoice'
const STRIPE_SOURCES = ['stripe-webhook', 'subscription-webhook']

type ErrRow = { id: string; message: string; context: Record<string, unknown> | null; created_at: string; user_id: string | null }

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)
    const { data: me } = await userClient.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return json({ error: 'Admin only' }, 403)

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const [cronRes, eventsRes, errorsRes] = await Promise.all([
      service.rpc('admin_cron_health'),
      // stripe_events is a small dedup ledger; recent rows reduce to last-event-per-type.
      service.from('stripe_events').select('id, type, processed_at').order('processed_at', { ascending: false }).limit(200),
      // One fetch, partitioned in TS below — avoids fragile JSON-path filters and NULL-source
      // NOT-IN semantics. Cap 200: ample while error_logs is near-empty; revisit if it grows.
      service.from('error_logs').select('id, message, context, created_at, user_id')
        .order('created_at', { ascending: false }).limit(200),
    ])
    if (cronRes.error) throw cronRes.error
    if (eventsRes.error) throw eventsRes.error
    if (errorsRes.error) throw errorsRes.error

    const lastByType: Record<string, string> = {}
    for (const e of eventsRes.data ?? []) {
      if (!(e.type in lastByType)) lastByType[e.type] = e.processed_at
    }

    const sourceOf = (r: ErrRow) => (r.context && typeof r.context.source === 'string' ? r.context.source : null)
    const rows = (errorsRes.data ?? []) as ErrRow[]
    const stripeFailures = rows.filter((r) => STRIPE_SOURCES.includes(sourceOf(r) ?? '')).slice(0, 20)
    const emailFailures = rows.filter((r) => sourceOf(r) === EMAIL_SOURCE).slice(0, 20)
    const clientErrors = rows.filter((r) => {
      const s = sourceOf(r)
      return s === null || (s !== EMAIL_SOURCE && !STRIPE_SOURCES.includes(s))
    }).slice(0, 20)

    return json({
      generatedAt: new Date().toISOString(),
      cron: (cronRes.data ?? []).map((j: Record<string, unknown>) => ({
        jobname: j.jobname, schedule: j.schedule, lastRunAt: j.last_run_at,
        lastStatus: j.last_status, lastMessage: j.last_message, failures7d: Number(j.failures_7d ?? 0),
      })),
      stripe: {
        lastByType: Object.entries(lastByType).map(([type, processedAt]) => ({ type, processedAt })),
        failures: stripeFailures,
      },
      emailFailures,
      clientErrors,
    })
  } catch (e) {
    console.error('admin-ops:', e instanceof Error ? e.message : String(e))
    return json({ error: 'Failed to load ops data' }, 500)
  }
})
