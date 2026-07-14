// github-link-repo — authenticated. Links a repo to a project (one repo per account) and
// backfills its open issues into github_issue_cards. Secrets: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY.
// Deploy: supabase functions deploy github-link-repo
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { getInstallationToken, listOpenIssues } from '../_shared/git-provider/githubApi.ts'
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

    const { projectId, repoId, repoFullName, defaultBranch } = await req.json()
    if (!projectId || !repoId || !repoFullName) return json({ error: 'Missing fields' }, 400)
    const numericRepoId = Number(repoId)

    const { data: inst } = await userClient.from('github_installations')
      .select('installation_id').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!inst) return json({ error: 'No GitHub installation connected' }, 400)

    // Ownership of the project (RLS makes this return null if not theirs).
    const { data: proj } = await userClient.from('projects').select('id').eq('id', projectId).maybeSingle()
    if (!proj) return json({ error: 'Project not found' }, 404)

    // One repo per account: reject if this repo is already linked (active) to a DIFFERENT project.
    const { data: existing } = await userClient.from('project_repos')
      .select('project_id').eq('repo_id', numericRepoId).is('disconnected_at', null)
    if ((existing ?? []).some((r) => r.project_id !== projectId)) {
      return json({ error: 'That repository is already linked to another project' }, 409)
    }

    // Link (project_id is unique → upsert refreshes a re-link of the same project).
    const { error: linkErr } = await userClient.from('project_repos').upsert({
      user_id: user.id,
      project_id: projectId,
      installation_id: inst.installation_id,
      repo_id: numericRepoId,
      repo_full_name: repoFullName,
      default_branch: defaultBranch || 'main',
      connected_at: new Date().toISOString(),
      disconnected_at: null,
    }, { onConflict: 'project_id' })
    if (linkErr) return json({ error: 'Could not link the repository' }, 500)

    // Backfill open issues (best-effort; service-role client — github_issue_cards is webhook-written).
    let issuesImported = 0
    try {
      const token = await getInstallationToken(Deno.env.get('GITHUB_APP_ID')!, Deno.env.get('GITHUB_APP_PRIVATE_KEY')!, inst.installation_id)
      const issues = await listOpenIssues(token, repoFullName)
      if (issues.length) {
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
        const rows = issues.map((i: any) => ({
          user_id: user.id,
          project_id: projectId,
          repo_id: numericRepoId,
          issue_number: i.number,
          title: i.title,
          state: i.state,
          html_url: i.html_url,
          labels: (i.labels ?? []).map((l: any) => (typeof l === 'string' ? l : l?.name)).filter(Boolean),
          assignee_login: i.assignee?.login ?? null,
          github_updated_at: i.updated_at,
          synced_at: new Date().toISOString(),
        }))
        const { error: bfErr } = await admin.from('github_issue_cards').upsert(rows, { onConflict: 'project_id,issue_number' })
        if (!bfErr) issuesImported = rows.length
      }
    } catch {
      // Backfill is best-effort; the webhook keeps the lane in sync going forward.
    }

    return json({ ok: true, repo: repoFullName, issuesImported })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
