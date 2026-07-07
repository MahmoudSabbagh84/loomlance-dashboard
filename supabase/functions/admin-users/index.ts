// admin-users — authenticated, admin-only. Support surface for the admin Users pages:
// list (roster via admin_user_list RPC), detail (per-user counts + audit history), and
// audited writes: comp (non-subscribers only) and reversible GoTrue bans.
// Guards live in _shared/adminUserGuards.ts (pure, unit-tested) — they are the boundary.
// Deploy: supabase functions deploy admin-users
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { compGuard, banGuard } from '../_shared/adminUserGuards.ts'
import { invoiceTotals } from '../_shared/money.ts'

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

    const body = await req.json().catch(() => ({}))
    const action = body?.action
    const userId = typeof body?.userId === 'string' ? body.userId : null

    // Audit trail: one row per successful write. Failure to audit never fails the action —
    // the action already happened; prefer an audit gap over a false error to the admin.
    const audit = async (targetId: string, payload: Record<string, unknown>) => {
      const { error } = await service.from('usage_events').insert({
        user_id: targetId,
        kind: 'admin_action',
        payload: { ...payload, actor_id: user.id, actor_email: user.email, at: new Date().toISOString() },
      })
      if (error) console.error('admin-users: audit insert failed', error.message)
    }

    if (action === 'list') {
      const { data, error } = await service.rpc('admin_user_list')
      if (error) throw error
      return json({ users: data })
    }

    if (action === 'detail') {
      if (!userId) return json({ error: 'userId required' }, 400)
      const { data: rows, error: listErr } = await service.rpc('admin_user_list')
      if (listErr) throw listErr
      const row = (rows ?? []).find((r: { id: string }) => r.id === userId)
      if (!row) return json({ error: 'User not found' }, 404)

      const count = async (table: string) => {
        const { count: n, error } = await service.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId)
        if (error) throw error
        return n ?? 0
      }
      const [clients, projects, invoicesRes, timeRes, historyRes] = await Promise.all([
        count('clients'),
        count('projects'),
        service.from('invoices').select('currency, invoice_line_items(quantity, unit_price, tax_rate, discount_rate)').eq('user_id', userId),
        service.from('time_entries').select('duration_minutes').eq('user_id', userId),
        service.from('usage_events').select('id, created_at, payload').eq('user_id', userId).eq('kind', 'admin_action')
          .order('created_at', { ascending: false }).limit(20),
      ])
      if (invoicesRes.error) throw invoicesRes.error
      if (timeRes.error) throw timeRes.error
      if (historyRes.error) throw historyRes.error

      const byCurrency: Record<string, number> = {}
      for (const inv of invoicesRes.data ?? []) {
        const cur = (inv.currency || 'USD').toUpperCase()
        byCurrency[cur] = Math.round(((byCurrency[cur] ?? 0) + invoiceTotals(inv.invoice_line_items ?? []).total) * 100) / 100
      }
      const hoursTracked = Math.round(((timeRes.data ?? []).reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / 60) * 10) / 10

      return json({
        user: row,
        counts: {
          clients,
          projects,
          invoices: (invoicesRes.data ?? []).length,
          hoursTracked,
          invoiced: Object.entries(byCurrency).map(([currency, total]) => ({ currency, total })),
        },
        history: historyRes.data ?? [],
      })
    }

    if (action === 'comp') {
      if (!userId) return json({ error: 'userId required' }, 400)
      const { data: target } = await service.from('profiles')
        .select('id, subscription_tier, stripe_subscription_id').eq('id', userId).maybeSingle()
      const guard = compGuard(target, body?.tier)
      if (!guard.ok) return json({ error: guard.message }, guard.status)
      const from = target!.subscription_tier
      const { error } = await service.from('profiles')
        .update({ subscription_tier: body.tier, subscription_status: 'active' }).eq('id', userId)
      if (error) throw error
      await audit(userId, { action: 'comp', from, to: body.tier })
      return json({ ok: true })
    }

    if (action === 'ban' || action === 'unban') {
      if (!userId) return json({ error: 'userId required' }, 400)
      const { data: target } = await service.from('profiles').select('id, is_admin').eq('id', userId).maybeSingle()
      if (action === 'ban') {
        const guard = banGuard(user.id, target)
        if (!guard.ok) return json({ error: guard.message }, guard.status)
      } else if (!target) {
        return json({ error: 'User not found' }, 404)
      }
      const { error } = await service.auth.admin.updateUserById(userId, {
        ban_duration: action === 'ban' ? '87600h' : 'none',
      })
      if (error) throw error
      await audit(userId, { action, from: action === 'ban' ? 'active' : 'banned', to: action === 'ban' ? 'banned' : 'active' })
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('admin-users:', e instanceof Error ? e.message : String(e))
    return json({ error: 'Request failed' }, 500)
  }
})
