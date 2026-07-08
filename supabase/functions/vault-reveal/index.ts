// vault-reveal — authenticated, owner-only. Decrypts ONE entry on demand; stamps last_accessed_at.
// Never logs the value. Deploy: supabase functions deploy vault-reveal
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { decryptSecret } from '../_shared/vaultCrypto.ts'

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

    const body = await req.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : null
    if (!id) return json({ error: 'Missing id' }, 400)

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const { data: rec } = await service.from('vault_credentials')
      .select('secret_ciphertext, secret_iv, wrapped_dek, dek_iv')
      .eq('id', id).eq('user_id', user.id).single()
    if (!rec) return json({ error: 'Not found' }, 404)

    let value: string
    try {
      value = await decryptSecret(rec, kek)
    } catch (_e) {
      return json({ error: "Couldn't unlock this credential" }, 422)
    }
    await service.from('vault_credentials').update({ last_accessed_at: new Date().toISOString() }).eq('id', id)
    return json({ value })
  } catch (_e) {
    return json({ error: 'Something went wrong' }, 500)
  }
})
