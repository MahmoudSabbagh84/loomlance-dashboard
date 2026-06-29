# GitHub Integration — Plan 2b: `github-webhook` (issue mirror + smart-commit completion)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the unauthenticated, signature-verified `github-webhook` Edge Function that mirrors GitHub issues into `github_issue_cards` and completes tasks from default-branch commit messages — consuming the already-tested `commitParse.ts`.

**Architecture:** A single Deno function `supabase/functions/github-webhook/index.ts` verifies `X-Hub-Signature-256` (HMAC-SHA256, a new pure `verifySignature.ts`), dedupes by `x-github-delivery` via `github_events`, and dispatches on `x-github-event`: `issues` → upsert/delete a `github_issue_cards` row; `push` → `parseCommit` + `resolveRefs` → move matched tasks to the project's done column and notify unmatched refs; `installation`/`installation_repositories` → cleanup. All DB writes use the service-role client (RLS bypass). The webhook is **payload-driven** — no GitHub API calls — so it needs no App token; only a webhook secret.

**Tech Stack:** Deno/TypeScript Edge Function (`jsr:@supabase/supabase-js@2`, Web Crypto), Vitest for the pure units, Supabase MCP `deploy_edge_function` for the compile/bundle gate.

**Why this is Plan 2b:** It's the completion engine and is fully buildable without the GitHub App (webhooks carry the data). Plan 2c (connect flow: App-token minter, `github-repos`, `github-link-repo`) and Plan 2d (frontend) follow. See `docs/superpowers/specs/2026-06-28-github-issue-sync-design.md`.

## Global Constraints

- **Edge module conventions** (from existing functions): import the client as `import { createClient } from 'jsr:@supabase/supabase-js@2'`; **no** `deno.json`/import-map; relative `_shared` imports keep the `.ts` extension; service-role client is `createClient(URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } })`.
- **JWT posture:** `github-webhook` is PUBLIC — add `[functions.github-webhook]\nverify_jwt = false` to `supabase/config.toml`. The HMAC signature is the auth.
- **Idempotency:** record `x-github-delivery` in `github_events` (pk `delivery_id`); a `23505` means already processed → `200`. On handler error, REMOVE the delivery record before returning `500` so GitHub's retry re-processes.
- **Done column:** the column whose `name ~* 'done'` (case-insensitive, mirrors `KanbanBoard.jsx:51`), highest `position` first; fall back to the highest-position column if none is named "done".
- **Push:** only process commits on the repo's default branch (`payload.ref === 'refs/heads/' + payload.repository.default_branch`).
- **Repo→project mapping:** `project_repos WHERE repo_id = <id> AND disconnected_at IS NULL` → `project_id`, `user_id`.
- **commitParse:** import `parseCommit`, `resolveRefs` from `../_shared/git-provider/commitParse.ts` (already exists, 18 tests). Do not reimplement.
- **Notifications:** `user_notifications` insert `{ user_id, kind, payload: { title, body }, link_to }`; unmatched-ref kind = `commit_unmatched_ref`.
- **No UTF-8 BOM** (`head -c3` ≠ `ef bb bf`). **Commits** end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT push (gated).
- **Compile gate:** each edge task ends by deploying via the Supabase MCP `deploy_edge_function` (it bundles + validates the code). A successful deploy is the syntax/bundle gate. Runtime integration (with a real signed payload) is an OWNER step (Task 5) — it needs `GITHUB_WEBHOOK_SECRET` set, which is owner-managed.

## Owner prerequisites (for go-live; NOT blockers for building this plan)
- Register the **"LoomLance" GitHub App** (Plan 2c covers the connect UI); set its webhook URL to `https://zbipqfsqxnvrzhpdjvvy.functions.supabase.co/github-webhook`, subscribe to `installation`, `installation_repositories`, `issues`, `push`.
- Set the Edge Function secret `GITHUB_WEBHOOK_SECRET` (= the App's webhook secret) via `supabase secrets set`.
- Ensure `github-webhook` is deployed with `verify_jwt = false` (deploy via `supabase functions deploy github-webhook`, which honors `config.toml`).

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/functions/_shared/git-provider/verifySignature.ts` | Pure HMAC-SHA256 GitHub signature verify | Create |
| `supabase/functions/_shared/git-provider/verifySignature.test.ts` | Vitest unit tests | Create |
| `supabase/functions/github-webhook/index.ts` | The webhook: verify, dedupe, dispatch, handlers | Create (Task 2) + extend (3–5) |
| `supabase/config.toml` | `[functions.github-webhook] verify_jwt = false` | Modify |

---

### Task 1: `verifySignature` — pure HMAC-SHA256 verification

**Files:**
- Create: `supabase/functions/_shared/git-provider/verifySignature.ts`
- Create: `supabase/functions/_shared/git-provider/verifySignature.test.ts`

**Interfaces:**
- Produces: `computeSignature(body: string, secret: string): Promise<string>` (→ `"sha256=<64 hex>"`); `verifyGithubSignature(body: string, signatureHeader: string | null, secret: string): Promise<boolean>` (constant-time compare; `false` if header or secret missing).

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/git-provider/verifySignature.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeSignature, verifyGithubSignature } from './verifySignature'

describe('github signature', () => {
  const secret = 'test-secret'
  const body = '{"action":"opened"}'

  it('computes a sha256= hex HMAC', async () => {
    expect(await computeSignature(body, secret)).toMatch(/^sha256=[0-9a-f]{64}$/)
  })
  it('verifies a correct signature', async () => {
    const sig = await computeSignature(body, secret)
    expect(await verifyGithubSignature(body, sig, secret)).toBe(true)
  })
  it('rejects a tampered body', async () => {
    const sig = await computeSignature(body, secret)
    expect(await verifyGithubSignature(body + ' ', sig, secret)).toBe(false)
  })
  it('rejects a wrong secret', async () => {
    const sig = await computeSignature(body, secret)
    expect(await verifyGithubSignature(body, sig, 'other-secret')).toBe(false)
  })
  it('rejects a missing header or secret', async () => {
    expect(await verifyGithubSignature(body, null, secret)).toBe(false)
    expect(await verifyGithubSignature(body, 'sha256=00', '')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- verifySignature`
Expected: FAIL — cannot resolve `./verifySignature`.
(If the run errors with `crypto is not defined` rather than a module-not-found, the test environment lacks Web Crypto — report it; the fix is to add `import { webcrypto as crypto } from 'node:crypto'` shim at the top of the TEST file only, leaving the module using the global `crypto`.)

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/_shared/git-provider/verifySignature.ts`:

```ts
// Pure HMAC-SHA256 verification of GitHub's X-Hub-Signature-256 header.
// Uses Web Crypto (global `crypto`, available in Deno and Node 20+), so Vitest tests it directly.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function computeSignature(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha256=${hex}`
}

export async function verifyGithubSignature(body: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader || !secret) return false
  const expected = await computeSignature(body, secret)
  return timingSafeEqual(expected, signatureHeader)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- verifySignature`
Expected: PASS (5 tests). Then `npm run test:run` once (full suite green).

- [ ] **Step 5: Verify no BOM + commit**

```bash
for f in supabase/functions/_shared/git-provider/verifySignature.ts supabase/functions/_shared/git-provider/verifySignature.test.ts; do printf '%s: ' "$f"; head -c3 "$f" | od -An -tx1; done
git add supabase/functions/_shared/git-provider/verifySignature.ts supabase/functions/_shared/git-provider/verifySignature.test.ts
git commit -m "feat(github): HMAC-SHA256 webhook signature verify (pure)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Webhook skeleton — verify, dedupe, dispatch (stub handlers) + config

**Files:**
- Create: `supabase/functions/github-webhook/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `verifyGithubSignature` (Task 1); `parseCommit`, `resolveRefs` (commitParse.ts — imported now, used in Task 4).
- Produces: the deployed `github-webhook` function with stub handlers `handleIssues`, `handlePush`, `handleInstallation`, `handleInstallationRepos` (filled in Tasks 3–5).

- [ ] **Step 1: Add the config.toml entry**

In `supabase/config.toml`, in the `[functions.*]` section (next to the other `verify_jwt = false` webhooks), add:
```toml
[functions.github-webhook]
verify_jwt = false
```

- [ ] **Step 2: Write the skeleton**

Create `supabase/functions/github-webhook/index.ts`:

```ts
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
```

- [ ] **Step 3: Deploy as the compile/bundle gate**

Load the Supabase MCP deploy tool (ToolSearch `select:mcp__supabase__deploy_edge_function`) and deploy `github-webhook` (the function source = the `github-webhook` directory; it imports `_shared`). Expected: deploy succeeds (this validates the TypeScript bundles, including the `_shared` imports). If the deploy reports a bundling error on the `_shared` relative imports, report it as BLOCKED — we'll adjust the import strategy.

- [ ] **Step 4: Smoke-test the signature gate**

The function is live but `GITHUB_WEBHOOK_SECRET` is unset (owner sets it later), so every signature fails → every POST is rejected. Confirm the function is up and rejecting:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://zbipqfsqxnvrzhpdjvvy.functions.supabase.co/github-webhook \
  -H "x-github-event: ping" -H "x-hub-signature-256: sha256=deadbeef" -d '{}'
```
Expected: `401` (invalid signature). (A `200` here would mean the signature gate is broken — investigate.) Note in your report: full success-path testing is the owner step in Task 5.

- [ ] **Step 5: Verify no BOM + commit**

```bash
printf 'index.ts: '; head -c3 supabase/functions/github-webhook/index.ts | od -An -tx1
git add supabase/functions/github-webhook/index.ts supabase/config.toml
git commit -m "feat(github): github-webhook skeleton (verify + dedupe + dispatch)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `handleIssues` — mirror open issues into `github_issue_cards`

**Files:**
- Modify: `supabase/functions/github-webhook/index.ts` (replace the `handleIssues` stub)

**Interfaces:**
- Consumes: `linkedRepo(admin, repoId)` (Task 2).

- [ ] **Step 1: Implement `handleIssues`**

Replace the `handleIssues` stub with:

```ts
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
```

- [ ] **Step 2: Deploy (compile gate)**

Deploy `github-webhook` via the Supabase MCP `deploy_edge_function`. Expected: success.

- [ ] **Step 3: Commit**

```bash
printf 'index.ts: '; head -c3 supabase/functions/github-webhook/index.ts | od -An -tx1
git add supabase/functions/github-webhook/index.ts
git commit -m "feat(github): webhook issues handler (mirror open issues)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `handlePush` — complete tasks from default-branch commit messages

**Files:**
- Modify: `supabase/functions/github-webhook/index.ts` (replace the `handlePush` stub; add `findDoneColumn`)

**Interfaces:**
- Consumes: `linkedRepo` (Task 2); `parseCommit`, `resolveRefs` (commitParse.ts).

- [ ] **Step 1: Add the import, then implement `handlePush` + `findDoneColumn`**

First add the commitParse import near the top of the file (below the `verifySignature` import), replacing the placeholder comment line:
```ts
import { parseCommit, resolveRefs } from '../_shared/git-provider/commitParse.ts'
```
Then replace the `handlePush` stub with:

```ts
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
```

- [ ] **Step 2: Deploy (compile gate)**

Deploy `github-webhook` via the Supabase MCP `deploy_edge_function`. Expected: success.

- [ ] **Step 3: Commit**

```bash
printf 'index.ts: '; head -c3 supabase/functions/github-webhook/index.ts | od -An -tx1
git add supabase/functions/github-webhook/index.ts
git commit -m "feat(github): webhook push handler (smart-commit task completion)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Installation cleanup handlers + owner verification doc

**Files:**
- Modify: `supabase/functions/github-webhook/index.ts` (replace `handleInstallation`, `handleInstallationRepos` stubs)
- Create: `docs/superpowers/github-webhook-verify.md` (owner integration-test steps)

**Interfaces:**
- Consumes: nothing new. (Installation row CREATION belongs to the Plan 2c connect callback, which knows the LoomLance user; the webhook only handles cleanup, since `installation.created` doesn't carry a LoomLance user id.)

- [ ] **Step 1: Implement the installation handlers**

Replace the two stubs with:

```ts
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
```

- [ ] **Step 2: Deploy (compile gate)**

Deploy `github-webhook` via the Supabase MCP `deploy_edge_function`. Expected: success.

- [ ] **Step 3: Write the owner verification doc**

Create `docs/superpowers/github-webhook-verify.md` with the runtime integration test the owner runs AFTER setting `GITHUB_WEBHOOK_SECRET` and deploying with `verify_jwt = false`:

```markdown
# github-webhook — owner integration verification

Prereqs: `GITHUB_WEBHOOK_SECRET` set (`supabase secrets set GITHUB_WEBHOOK_SECRET=<secret>`),
and `github-webhook` deployed with `verify_jwt = false` (`supabase functions deploy github-webhook`).

## 1. Seed a test link + task (SQL, via the dashboard SQL editor or MCP)
- Pick one of your projects (note its id, user_id, task_key) and a task in it (note its ref_number).
- Insert a project_repos row linking a fake repo to that project:
  `insert into project_repos (user_id, project_id, installation_id, repo_id, repo_full_name)
   values ('<user_id>','<project_id>', 1, 999001, 'you/test-repo');`

## 2. Send a signed `push` that completes the task
Run locally (bash); set SECRET to the webhook secret and KEY/NUM to the task's key/ref_number:
```bash
SECRET='<webhook secret>'
BODY=$(cat <<'JSON'
{"ref":"refs/heads/main","repository":{"id":999001,"default_branch":"main"},
 "commits":[{"message":"<KEY>-<NUM> done"}]}
JSON
)
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://zbipqfsqxnvrzhpdjvvy.functions.supabase.co/github-webhook \
  -H "x-github-event: push" -H "x-github-delivery: test-$(date +%s)" \
  -H "x-hub-signature-256: $SIG" -H "content-type: application/json" \
  --data-binary "$BODY"
```
Expected: `200`. Then confirm in the app/board that the task moved to the Done column.

## 3. Send a signed `issues` opened event
Same signing, `x-github-event: issues`, body:
`{"action":"opened","repository":{"id":999001},"issue":{"number":1,"title":"Test issue","state":"open","html_url":"https://x","labels":[],"updated_at":"2026-06-30T00:00:00Z"}}`
Expected: `200`, and a `github_issue_cards` row appears for the project. Send `{"action":"closed",...}` → the row is deleted.

## 4. Cleanup
`delete from project_repos where repo_id = 999001;`
`delete from github_issue_cards where repo_id = 999001;`
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/github-webhook/index.ts docs/superpowers/github-webhook-verify.md
git commit -m "feat(github): webhook installation cleanup + owner verify doc

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- `verifySignature.ts` exports `computeSignature` + `verifyGithubSignature`, unit-tested (correct/tampered/wrong-secret/missing).
- `github-webhook` deploys cleanly (bundle gate passes) and rejects unsigned/badly-signed POSTs with `401`.
- `issues` events upsert/delete `github_issue_cards`; `push` events on the default branch complete matched tasks (moved to the done column) and notify unmatched refs; `installation`/`installation_repositories` deletions disconnect linked repos; deliveries are idempotent via `github_events`.
- `config.toml` pins `verify_jwt = false`; no BOM; full Vitest suite green.
- The owner integration test (`docs/superpowers/github-webhook-verify.md`) is ready for the post-secret runtime verification.

**Plan 2c** adds the connect flow (App-token minter, `github-repos`, `github-link-repo` + issue backfill) — the authenticated side that creates `github_installations`/`project_repos` rows and needs the registered GitHub App. **Plan 2d** adds the frontend (Integrations settings, the read-only issues lane, the scope toggle, and surfacing `commit_unmatched_ref` notifications).
