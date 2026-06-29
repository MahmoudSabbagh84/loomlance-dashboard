// github-webhook — receives GitHub App events (UNAUTHENTICATED; the X-Hub-Signature-256 HMAC IS the auth).
// JWT posture pinned in config.toml ([functions.github-webhook] verify_jwt = false).
// Deploy: supabase functions deploy github-webhook
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { verifyGithubSignature } from '../_shared/git-provider/verifySignature.ts'
import { parseCommit, resolveRefs } from '../_shared/git-provider/commitParse.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const bodyText = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  const eventType = req.headers.get('x-github-event') ?? ''
  const deliveryId = req.headers.get('x-github-delivery') ?? ''

  if (!(await verifyGithubSignature(bodyText, signature, Deno.env.get('GITHUB_WEBHOOK_SECRET') ?? ''))) {
    return new Response('invalid signature', { status: 401 })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // Idempotency: record this delivery; a unique-violation means we've already handled it.
  if (deliveryId) {
    const { error: dupErr } = await admin.from('github_events').insert({ delivery_id: deliveryId, event_type: eventType })
    if (dupErr) {
      if (dupErr.code === '23505') return new Response('already processed', { status: 200 })
      return new Response('ledger error', { status: 500 })
    }
  }

  let payload: any
  try {
    payload = JSON.parse(bodyText)
  } catch {
    return new Response('bad json', { status: 400 })
  }

  try {
    switch (eventType) {
      case 'issues': await handleIssues(admin, payload); break
      case 'push': await handlePush(admin, payload); break
      case 'installation': await handleInstallation(admin, payload); break
      case 'installation_repositories': await handleInstallationRepos(admin, payload); break
      default: break // other events are acknowledged but ignored
    }
  } catch (e) {
    // Un-record the delivery so GitHub's retry re-processes (handlers are otherwise idempotent).
    if (deliveryId) await admin.from('github_events').delete().eq('delivery_id', deliveryId)
    console.error('github-webhook handler error', eventType, e)
    return new Response('handler error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
})

// Map a GitHub repo id to its linked LoomLance project (or null if not linked).
async function linkedRepo(admin: SupabaseClient, repoId: number): Promise<{ project_id: string; user_id: string } | null> {
  const { data } = await admin
    .from('project_repos')
    .select('project_id, user_id')
    .eq('repo_id', repoId)
    .is('disconnected_at', null)
    .maybeSingle()
  return data ?? null
}

// --- stub handlers (filled in Tasks 3–5) ---
// issues: upsert the open-issue card; on closed/deleted, remove it (the lane shows only open issues).
async function handleIssues(admin: SupabaseClient, payload: any): Promise<void> {
  const repoId = payload?.repository?.id
  const issue = payload?.issue
  if (!repoId || !issue) return
  const repo = await linkedRepo(admin, repoId)
  if (!repo) return // repo not linked to a project — ignore

  if (payload.action === 'closed' || payload.action === 'deleted') {
    await admin.from('github_issue_cards').delete()
      .eq('project_id', repo.project_id)
      .eq('issue_number', issue.number)
    return
  }

  await admin.from('github_issue_cards').upsert({
    user_id: repo.user_id,
    project_id: repo.project_id,
    repo_id: repoId,
    issue_number: issue.number,
    title: issue.title,
    state: issue.state,
    html_url: issue.html_url,
    labels: (issue.labels ?? []).map((l: any) => (typeof l === 'string' ? l : l?.name)).filter(Boolean),
    assignee_login: issue.assignee?.login ?? null,
    github_updated_at: issue.updated_at,
    synced_at: new Date().toISOString(),
  }, { onConflict: 'project_id,issue_number' })
}

// push: parse default-branch commit messages, resolve refs per the user's scope mode,
// move matched tasks to the project's done column, and notify on unmatched refs.
async function handlePush(admin: SupabaseClient, payload: any): Promise<void> {
  const repoId = payload?.repository?.id
  const defaultBranch = payload?.repository?.default_branch
  if (!repoId || !defaultBranch) return
  if (payload.ref !== `refs/heads/${defaultBranch}`) return // default branch only

  const repo = await linkedRepo(admin, repoId)
  if (!repo) return

  // Collect deduped refs across all commits in the push.
  const refs: Array<{ key: string; number: number }> = []
  const seen = new Set<string>()
  for (const c of Array.isArray(payload.commits) ? payload.commits : []) {
    for (const r of parseCommit(c?.message ?? '')) {
      const id = `${r.key}-${r.number}`
      if (!seen.has(id)) { seen.add(id); refs.push(r) }
    }
  }
  if (refs.length === 0) return

  const { data: profile } = await admin.from('profiles')
    .select('commit_completion_scope').eq('id', repo.user_id).single()
  const mode = profile?.commit_completion_scope === 'cross_project' ? 'cross_project' : 'project'

  const { data: projects } = await admin.from('projects')
    .select('id, task_key').eq('user_id', repo.user_id)

  const { matched, unmatched } = resolveRefs(refs, {
    mode,
    linkedProjectId: repo.project_id,
    projects: projects ?? [],
  })

  for (const m of matched) {
    const doneColId = await findDoneColumn(admin, m.projectId)
    if (!doneColId) continue
    await admin.from('tasks').update({ column_id: doneColId })
      .eq('project_id', m.projectId).eq('ref_number', m.number)
  }

  for (const u of unmatched) {
    await admin.from('user_notifications').insert({
      user_id: repo.user_id,
      kind: 'commit_unmatched_ref',
      payload: { title: `Commit referenced ${u.key}-${u.number}`, body: 'No matching task — check the task key.' },
      link_to: `/projects/${repo.project_id}`,
    })
  }
}

// The project's "done" column: prefer a column named like "done" (matching the board's /done/i
// rule), else the highest-position column.
async function findDoneColumn(admin: SupabaseClient, projectId: string): Promise<string | null> {
  const named = await admin.from('kanban_columns').select('id')
    .eq('project_id', projectId).ilike('name', '%done%')
    .order('position', { ascending: false }).limit(1).maybeSingle()
  if (named.data?.id) return named.data.id
  const last = await admin.from('kanban_columns').select('id')
    .eq('project_id', projectId).order('position', { ascending: false }).limit(1).maybeSingle()
  return last.data?.id ?? null
}

// installation: on delete, remove the installation row and disconnect its linked repos.
// (Row CREATION is done by the authenticated connect callback in Plan 2c — the webhook
// cannot know which LoomLance user a brand-new installation belongs to.)
async function handleInstallation(admin: SupabaseClient, payload: any): Promise<void> {
  const installationId = payload?.installation?.id
  if (!installationId) return
  if (payload.action === 'deleted') {
    await admin.from('project_repos').update({ disconnected_at: new Date().toISOString() })
      .eq('installation_id', installationId).is('disconnected_at', null)
    await admin.from('github_installations').delete().eq('installation_id', installationId)
  }
}

// installation_repositories: when repos are removed from the installation, disconnect any
// project linked to them. (Additions need no action — the connect UI reads repos on demand.)
async function handleInstallationRepos(admin: SupabaseClient, payload: any): Promise<void> {
  const removed = Array.isArray(payload?.repositories_removed) ? payload.repositories_removed : []
  for (const r of removed) {
    if (!r?.id) continue
    await admin.from('project_repos').update({ disconnected_at: new Date().toISOString() })
      .eq('repo_id', r.id).is('disconnected_at', null)
  }
}
