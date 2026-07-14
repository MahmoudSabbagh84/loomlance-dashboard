// vault-store — authenticated, owner-only. Encrypts a secret (envelope) and upserts the row.
// Called ONLY on create or when the secret changes; metadata-only edits go through the table.
// Deploy: supabase functions deploy vault-store
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { encryptSecret } from '../_shared/vaultCrypto.ts'
import { getSubscriptionTier, isPaidTier } from '../_shared/tier.ts'

Deno.serve(async (req) => {
  const json = (o: unknown, s = 200) => jsonBase(o, s, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const kek = Deno.env.get('VAULT_MASTER_KEY')
    if (!kek) return json({ error: 'Vault not configured' }, 500)
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    if (!isPaidTier(await getSubscriptionTier(userClient, user.id)))
      return json({ error: 'The credential vault requires a Freelancer or Studio plan' }, 403)

    const body = await req.json().catch(() => ({}))
    const secret = typeof body?.secret === 'string' ? body.secret : ''
    if (!secret) return json({ error: 'A secret value is required' }, 400)

    const enc = await encryptSecret(secret, kek)
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const meta: Record<string, unknown> = {
      label: body.label, type: body.type, username: body.username ?? null,
      url: body.url ?? null, notes: body.notes ?? null, project_id: body.project_id ?? null,
    }

    if (body.id) {
      // Update: ownership-scoped; touch provided metadata + the four ciphertext columns.
      const patch: Record<string, unknown> = { ...enc, enc_version: 1 }
      for (const k of ['label', 'type', 'username', 'url', 'notes', 'project_id']) {
        if (body[k] !== undefined) patch[k] = meta[k]
      }
      const { data, error } = await service.from('vault_credentials')
        .update(patch).eq('id', body.id).eq('user_id', user.id).select('id').single()
      if (error || !data) return json({ error: 'Not found' }, 404)
      return json({ id: data.id })
    }

    if (!meta.label || !meta.type) return json({ error: 'Label and type are required' }, 400)
    const { data, error } = await service.from('vault_credentials')
      .insert({ user_id: user.id, ...meta, ...enc }).select('id').single()
    if (error) return json({ error: 'Could not save credential' }, 400)
    return json({ id: data.id })
  } catch (_e) {
    return json({ error: 'Something went wrong' }, 500)
  }
})
