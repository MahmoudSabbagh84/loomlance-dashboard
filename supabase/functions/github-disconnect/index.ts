// github-disconnect — authenticated. Uninstalls the GitHub App from the user's account
// (revokes its repo access) and removes all local GitHub records for the user.
// Secrets: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY.
// Deploy: supabase functions deploy github-disconnect
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { deleteInstallation } from '../_shared/git-provider/githubApi.ts'

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const { data: inst } = await userClient.from('github_installations')
      .select('installation_id').order('created_at', { ascending: false }).limit(1).maybeSingle()

    // Best-effort uninstall on GitHub (revokes access); proceed with local cleanup even if it's already gone.
    if (inst) {
      try {
        await deleteInstallation(Deno.env.get('GITHUB_APP_ID')!, Deno.env.get('GITHUB_APP_PRIVATE_KEY')!, inst.installation_id)
      } catch {
        // already uninstalled / transient — fall through to cleanup
      }
    }

    // Remove all local GitHub records for this user (service-role: github_issue_cards has no user write policy).
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    await admin.from('github_issue_cards').delete().eq('user_id', user.id)
    await admin.from('project_repos').delete().eq('user_id', user.id)
    await admin.from('github_installations').delete().eq('user_id', user.id)

    return json({ ok: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
