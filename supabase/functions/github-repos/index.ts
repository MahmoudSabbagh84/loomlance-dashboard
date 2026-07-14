// github-repos — authenticated. Lists repositories the user's GitHub installation can access.
// Secrets: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY.
// Deploy: supabase functions deploy github-repos
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { getInstallationToken, listInstallationRepos } from '../_shared/git-provider/githubApi.ts'
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

    // The user's most recent installation (RLS-scoped to this user).
    const { data: inst } = await userClient.from('github_installations')
      .select('installation_id').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!inst) return json({ error: 'No GitHub installation connected' }, 400)

    const token = await getInstallationToken(Deno.env.get('GITHUB_APP_ID')!, Deno.env.get('GITHUB_APP_PRIVATE_KEY')!, inst.installation_id)
    const repos = await listInstallationRepos(token)
    return json({ repos })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
