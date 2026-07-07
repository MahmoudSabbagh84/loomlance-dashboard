// admin-metrics — authenticated, admin-only. Returns every Business Pulse number in one
// payload: user/signup aggregates (admin_user_stats RPC), tier mix from profiles, live
// Stripe MRR + trial funnel, and 7d/30d product-usage counts (demo user excluded).
// Stripe failure degrades to { stripe: null, stripeError: true } — DB metrics still render.
// Secrets: STRIPE_SECRET_KEY (already set for checkout/webhooks).
// Deploy: supabase functions deploy admin-metrics
import Stripe from 'npm:stripe@^16'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { computeStripeMetrics } from '../_shared/metrics.ts'

const stripeClient = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' })
const DEMO_USER_ID = 'd3a70000-0000-4000-8000-000000000001'
const SUB_CAP = 1000

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

    const { data: profile } = await userClient.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return json({ error: 'Admin only' }, 403)

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const now = Date.now()
    const d7 = new Date(now - 7 * 86400_000).toISOString()
    const d30 = new Date(now - 30 * 86400_000).toISOString()

    // Windowed count on a table, excluding the demo user's rows.
    const countSince = async (table: string, col: string, since: string) => {
      const { count, error } = await service
        .from(table).select('id', { count: 'exact', head: true })
        .gte(col, since).neq('user_id', DEMO_USER_ID)
      if (error) throw error
      return count ?? 0
    }
    const window = async (table: string, col: string) => {
      const [d7c, d30c] = await Promise.all([countSince(table, col, d7), countSince(table, col, d30)])
      return { d7: d7c, d30: d30c }
    }

    const [userStatsRes, profilesRes, invCreated, invSent, projects, clients, timeRes] = await Promise.all([
      service.rpc('admin_user_stats'),
      service.from('profiles').select('subscription_tier, subscription_status').neq('id', DEMO_USER_ID),
      window('invoices', 'created_at'),
      window('invoices', 'sent_at'),
      window('projects', 'created_at'),
      window('clients', 'created_at'),
      service.from('time_entries').select('duration_minutes, started_at').gte('started_at', d30).neq('user_id', DEMO_USER_ID),
    ])
    if (userStatsRes.error) throw userStatsRes.error
    if (profilesRes.error) throw profilesRes.error
    if (timeRes.error) throw timeRes.error

    const tiers = { free: 0, tier_1: 0, tier_2: 0, trialing: 0, pastDue: 0 }
    for (const p of profilesRes.data ?? []) {
      if (p.subscription_tier in tiers) tiers[p.subscription_tier as 'free' | 'tier_1' | 'tier_2']++
      if (p.subscription_status === 'trialing') tiers.trialing++
      if (p.subscription_status === 'past_due') tiers.pastDue++
    }

    const toHours = (rows: { duration_minutes: number | null }[]) =>
      Math.round((rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / 60) * 10) / 10
    const teRows = timeRes.data ?? []
    const hoursTracked = { d7: toHours(teRows.filter((r) => r.started_at >= d7)), d30: toHours(teRows) }

    let stripe = null
    let stripeError = false
    try {
      const subs = []
      for await (const s of stripeClient.subscriptions.list({ status: 'all', limit: 100 })) {
        subs.push(s)
        if (subs.length >= SUB_CAP) { console.warn(`admin-metrics: subscription cap (${SUB_CAP}) hit — MRR may be partial`); break }
      }
      stripe = computeStripeMetrics(subs)
    } catch (e) {
      console.error('admin-metrics: stripe failed', e instanceof Error ? e.message : String(e))
      stripeError = true
    }

    return json({
      generatedAt: new Date(now).toISOString(),
      users: userStatsRes.data,
      tiers,
      stripe,
      ...(stripeError ? { stripeError: true } : {}),
      usage: { invoicesCreated: invCreated, invoicesSent: invSent, projectsCreated: projects, hoursTracked, clientsAdded: clients },
    })
  } catch (e) {
    console.error('admin-metrics:', e instanceof Error ? e.message : String(e))
    return json({ error: 'Failed to load metrics' }, 500)
  }
})
