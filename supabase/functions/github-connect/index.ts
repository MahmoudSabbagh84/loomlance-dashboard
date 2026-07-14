// github-connect — authenticated. Records the GitHub App installation for the current user
// (called by the frontend after the user installs the App and GitHub redirects back with
// installation_id). Secrets: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY.
// Deploy: supabase functions deploy github-connect
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { getInstallation } from '../_shared/git-provider/githubApi.ts'
import { getSubscriptionTier, isPaidTier } from '../_shared/tier.ts'

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    if (!isPaidTier(await getSubscriptionTier(userClient, user.id)))
      return json({ error: 'GitHub integration requires a Freelancer or Studio plan' }, 403)

    const { installationId } = await req.json()
    const instId = Number(installationId)
    if (!Number.isInteger(instId) || instId <= 0) return json({ error: 'Invalid installation' }, 400)

    let account: { account_login: string | null; account_type: string | null }
    try {
      account = await getInstallation(Deno.env.get('GITHUB_APP_ID')!, Deno.env.get('GITHUB_APP_PRIVATE_KEY')!, instId)
    } catch {
      return json({ error: 'Could not verify the GitHub installation' }, 400)
    }

    const { error } = await userClient.from('github_installations').upsert({
      user_id: user.id,
      installation_id: instId,
      account_login: account.account_login,
      account_type: account.account_type,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'installation_id' })
    if (error) {
      // 23505 = unique violation; 42501 = RLS denies the conflict-UPDATE on another user's row.
      const taken = error.code === '23505' || error.code === '42501'
      return json({ error: taken ? 'This installation is already connected to another account' : 'Could not save the installation' }, taken ? 409 : 500)
    }

    return json({ ok: true, account: account.account_login })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
