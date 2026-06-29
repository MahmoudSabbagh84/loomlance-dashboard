// github-webhook — receives GitHub App events (UNAUTHENTICATED; the X-Hub-Signature-256 HMAC IS the auth).
// JWT posture pinned in config.toml ([functions.github-webhook] verify_jwt = false).
// Deploy: supabase functions deploy github-webhook
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { verifyGithubSignature } from '../_shared/git-provider/verifySignature.ts'
// (parseCommit/resolveRefs are imported in Task 4, where handlePush uses them.)

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
async function handleIssues(_admin: SupabaseClient, _payload: any): Promise<void> {}
async function handlePush(_admin: SupabaseClient, _payload: any): Promise<void> {}
async function handleInstallation(_admin: SupabaseClient, _payload: any): Promise<void> {}
async function handleInstallationRepos(_admin: SupabaseClient, _payload: any): Promise<void> {}
