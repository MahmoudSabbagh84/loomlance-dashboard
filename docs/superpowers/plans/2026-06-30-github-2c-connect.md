# GitHub Integration — Plan 2c: Connect flow (App auth + connect / repos / link + backfill)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated side of the GitHub integration — mint GitHub App installation tokens, record a user's installation, list its repos, and link a repo to a project (one repo per account) with an initial open-issue backfill.

**Architecture:** A `_shared/git-provider/githubApi.ts` module hand-rolls the GitHub App auth — `createAppJwt` (RS256 via Web Crypto, **unit-tested**) → `getInstallationToken` → REST helpers. Three authenticated Edge Functions follow the repo's canonical pattern (`create-billing-portal`): `github-connect` (record the installation), `github-repos` (list installation repos), `github-link-repo` (link + backfill). Installation/link rows are written with the **user-scoped** client (RLS `with check (user_id = auth.uid())`); the issue-card backfill uses the **service-role** client (`github_issue_cards` is webhook-written). The frontend (Plan 2d) calls these via `invokeEdge(...)`.

**Tech Stack:** Deno/TypeScript Edge Functions (`jsr:@supabase/supabase-js@2`, Web Crypto RS256, `fetch` to `api.github.com`), Vitest for `createAppJwt`, Supabase MCP `deploy_edge_function` (compile gate).

**Why this is Plan 2c:** It's the App-gated half (token minting needs the registered App + secrets). Plan 2b (the webhook) is done and live. Plan 2d is the frontend (Integrations tab, issues lane, scope toggle). See `docs/superpowers/specs/2026-06-28-github-issue-sync-design.md`.

## Global Constraints

- **Auth-function pattern (canonical, from `create-billing-portal`):** `import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'`; `const json = (obj, status=200) => jsonBase(obj, status, req)`; `if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })`; a **user-scoped client** (anon key + forwarded `Authorization`) → `auth.getUser()` → `json({ error: 'Not authenticated' }, 401)` if no user; success returns `json({ ... })`, errors return `json({ error: '...' }, 4xx/5xx)` (the `error` string surfaces to the UI via `invokeEdge`).
- **RLS:** write `github_installations` / `project_repos` with the **user-scoped** client (the `_insert_own`/`_update_own` policies pass when `user_id = auth.uid()`). Write `github_issue_cards` (backfill) with the **service-role admin** client (no user insert policy).
- **JWT posture:** the three functions are AUTHENTICATED — add `[functions.github-connect]`, `[functions.github-repos]`, `[functions.github-link-repo]` each with `verify_jwt = true` to `config.toml`.
- **App JWT:** RS256, `iss = GITHUB_APP_ID`, `iat = now-60`, `exp = now+540` (≤10 min). Private key is `GITHUB_APP_PRIVATE_KEY` in **PKCS#8 PEM** (`-----BEGIN PRIVATE KEY-----`); the loader must tolerate `\n`-escaped newlines (env-var form).
- **One repo per account:** `github-link-repo` rejects linking a repo already linked (active) to a different project; `project_id` is unique so re-linking the same project upserts.
- **GitHub API:** `fetch('https://api.github.com/...', { headers: { Authorization: 'Bearer <token>', Accept: 'application/vnd.github+json', 'User-Agent': 'LoomLance' } })`; non-2xx throws.
- **No UTF-8 BOM**; commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT push (gated).
- **Compile gate:** each edge task ends by deploying via the Supabase MCP `deploy_edge_function` (bundles + validates). Full runtime is OWNER-gated (needs the registered App + `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY`/`GITHUB_WEBHOOK_SECRET`) — Task 4 writes the owner setup doc.

## Owner prerequisites (go-live; NOT blockers for building)
- Register the **"LoomLance" GitHub App** (Issues: read, Metadata: read, Contents: read; webhook URL `https://zbipqfsqxnvrzhpdjvvy.functions.supabase.co/github-webhook`; subscribe installation/installation_repositories/issues/push; set the **Setup/callback URL** to `https://app.loomlance.com/profile?tab=integrations`).
- Download the App private key (PKCS#1) and convert to PKCS#8: `openssl pkcs8 -topk8 -nocrypt -in app.private-key.pem -out app.pk8.pem`.
- `supabase secrets set GITHUB_APP_ID=<numeric id> GITHUB_APP_PRIVATE_KEY="$(cat app.pk8.pem)" GITHUB_WEBHOOK_SECRET=<webhook secret>`.

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/functions/_shared/git-provider/githubApi.ts` | `createAppJwt` + token/REST helpers | Create |
| `supabase/functions/_shared/git-provider/githubApi.test.ts` | Vitest tests for `createAppJwt` | Create |
| `supabase/functions/github-connect/index.ts` | Record the user's installation | Create |
| `supabase/functions/github-repos/index.ts` | List installation repos | Create |
| `supabase/functions/github-link-repo/index.ts` | Link repo→project + backfill issues | Create |
| `supabase/config.toml` | 3 × `verify_jwt = true` | Modify |
| `docs/superpowers/github-app-setup.md` | Owner App registration + secrets + connect test | Create |

---

### Task 1: `githubApi.ts` — App JWT + REST helpers (`createAppJwt` unit-tested)

**Files:**
- Create: `supabase/functions/_shared/git-provider/githubApi.ts`
- Create: `supabase/functions/_shared/git-provider/githubApi.test.ts`

**Interfaces:**
- Produces: `createAppJwt(appId, pkcs8Pem, nowSec?) → Promise<string>` (pure, tested); `getInstallationToken(appId, pkcs8Pem, installationId) → Promise<string>`; `getInstallation(appId, pkcs8Pem, installationId) → Promise<{account_login, account_type}>`; `listInstallationRepos(token) → Promise<Array<{id, full_name, default_branch}>>`; `listOpenIssues(token, fullName) → Promise<any[]>`.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/git-provider/githubApi.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createAppJwt } from './githubApi'

function derToPem(der: ArrayBuffer): string {
  const bytes = new Uint8Array(der)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = btoa(bin).match(/.{1,64}/g)!.join('\n')
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`
}
function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
async function genKey() {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  )
}

describe('createAppJwt', () => {
  it('produces a verifiable RS256 JWT with the right claims', async () => {
    const kp = await genKey()
    const pem = derToPem(await crypto.subtle.exportKey('pkcs8', kp.privateKey))
    const now = 1700000000
    const jwt = await createAppJwt('123456', pem, now)
    const [h, p, s] = jwt.split('.')
    const enc = new TextEncoder()
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kp.publicKey, b64urlToBytes(s), enc.encode(`${h}.${p}`))
    expect(ok).toBe(true)
    expect(JSON.parse(new TextDecoder().decode(b64urlToBytes(h)))).toEqual({ alg: 'RS256', typ: 'JWT' })
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)))
    expect(payload.iss).toBe('123456')
    expect(payload.iat).toBe(now - 60)
    expect(payload.exp).toBe(now + 540)
  })

  it('tolerates \\n-escaped PEM (env-var form)', async () => {
    const kp = await genKey()
    const pem = derToPem(await crypto.subtle.exportKey('pkcs8', kp.privateKey)).replace(/\n/g, '\\n')
    const jwt = await createAppJwt('1', pem, 1700000000)
    const [h, p, s] = jwt.split('.')
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kp.publicKey, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`))
    expect(ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- githubApi`
Expected: FAIL — cannot resolve `./githubApi`.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/_shared/git-provider/githubApi.ts`:

```ts
// GitHub App auth + REST helpers for the connect flow. `createAppJwt` is pure and unit-tested;
// the fetch helpers are integration-verified (owner). RS256 via Web Crypto — no external deps.

const GH_API = 'https://api.github.com'

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(body)
  const der = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i)
  return der
}

// Build a signed GitHub App JWT (RS256). `nowSec` defaults to the current time.
export async function createAppJwt(appId: string, pkcs8Pem: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const enc = new TextEncoder()
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = { iat: nowSec - 60, exp: nowSec + 540, iss: String(appId) }
  const signingInput = `${base64url(enc.encode(JSON.stringify(header)))}.${base64url(enc.encode(JSON.stringify(payload)))}`
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(pkcs8Pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput))
  return `${signingInput}.${base64url(new Uint8Array(sig))}`
}

async function gh(token: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'LoomLance',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}: ${await res.text()}`)
  return res
}

export async function getInstallationToken(appId: string, pkcs8Pem: string, installationId: number): Promise<string> {
  const jwt = await createAppJwt(appId, pkcs8Pem)
  const res = await gh(jwt, `/app/installations/${installationId}/access_tokens`, { method: 'POST' })
  return (await res.json()).token
}

export async function getInstallation(appId: string, pkcs8Pem: string, installationId: number): Promise<{ account_login: string | null; account_type: string | null }> {
  const jwt = await createAppJwt(appId, pkcs8Pem)
  const data = await (await gh(jwt, `/app/installations/${installationId}`)).json()
  return { account_login: data.account?.login ?? null, account_type: data.account?.type ?? null }
}

export async function listInstallationRepos(token: string): Promise<Array<{ id: number; full_name: string; default_branch: string }>> {
  const data = await (await gh(token, `/installation/repositories?per_page=100`)).json()
  return (data.repositories ?? []).map((r: any) => ({ id: r.id, full_name: r.full_name, default_branch: r.default_branch }))
}

export async function listOpenIssues(token: string, fullName: string): Promise<any[]> {
  const data = await (await gh(token, `/repos/${fullName}/issues?state=open&per_page=100`)).json()
  return (data ?? []).filter((i: any) => !i.pull_request)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- githubApi`
Expected: PASS (2 tests). Then `npm run test:run` once (full suite green).

- [ ] **Step 5: Verify no BOM + commit**

```bash
for f in supabase/functions/_shared/git-provider/githubApi.ts supabase/functions/_shared/git-provider/githubApi.test.ts; do printf '%s: ' "$f"; head -c3 "$f" | od -An -tx1; done
git add supabase/functions/_shared/git-provider/githubApi.ts supabase/functions/_shared/git-provider/githubApi.test.ts
git commit -m "feat(github): App JWT (RS256) + REST helpers (createAppJwt unit-tested)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `github-connect` — record the user's installation (+ config entries)

**Files:**
- Create: `supabase/functions/github-connect/index.ts`
- Modify: `supabase/config.toml` (add all 3 new function blocks)

**Interfaces:**
- Consumes: `getInstallation` (Task 1).
- Frontend contract: `invokeEdge('github-connect', { installationId })` → `{ ok, account }` or `{ error }`.

- [ ] **Step 1: Add all three config.toml entries**

In `supabase/config.toml`, after the `[functions.github-webhook]` block, add:
```toml
[functions.github-connect]
verify_jwt = true

[functions.github-repos]
verify_jwt = true

[functions.github-link-repo]
verify_jwt = true
```

- [ ] **Step 2: Write `github-connect/index.ts`**

```ts
// github-connect — authenticated. Records the GitHub App installation for the current user
// (called by the frontend after the user installs the App and GitHub redirects back with
// installation_id). Secrets: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY.
// Deploy: supabase functions deploy github-connect
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { getInstallation } from '../_shared/git-provider/githubApi.ts'

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

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
      // A unique-violation means another user already owns this installation_id.
      const taken = error.code === '23505'
      return json({ error: taken ? 'This installation is already connected to another account' : 'Could not save the installation' }, taken ? 409 : 500)
    }

    return json({ ok: true, account: account.account_login })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
```

- [ ] **Step 3: Deploy (compile gate)**

Deploy `github-connect` via the Supabase MCP `deploy_edge_function` (ToolSearch `select:mcp__supabase__deploy_edge_function`). Expected: success. If bundling fails on the `_shared` import, report BLOCKED.

- [ ] **Step 4: Verify no BOM + commit**

```bash
printf 'index.ts: '; head -c3 supabase/functions/github-connect/index.ts | od -An -tx1
git add supabase/functions/github-connect/index.ts supabase/config.toml
git commit -m "feat(github): github-connect (record installation)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `github-repos` — list the installation's repositories

**Files:**
- Create: `supabase/functions/github-repos/index.ts`

**Interfaces:**
- Consumes: `getInstallationToken`, `listInstallationRepos` (Task 1).
- Frontend contract: `invokeEdge('github-repos', {})` → `{ repos: [{ id, full_name, default_branch }] }` or `{ error }`.

- [ ] **Step 1: Write `github-repos/index.ts`**

```ts
// github-repos — authenticated. Lists repositories the user's GitHub installation can access.
// Secrets: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY.
// Deploy: supabase functions deploy github-repos
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { getInstallationToken, listInstallationRepos } from '../_shared/git-provider/githubApi.ts'

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

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
```

- [ ] **Step 2: Deploy (compile gate)**

Deploy `github-repos` via the Supabase MCP `deploy_edge_function`. Expected: success.

- [ ] **Step 3: Verify no BOM + commit**

```bash
printf 'index.ts: '; head -c3 supabase/functions/github-repos/index.ts | od -An -tx1
git add supabase/functions/github-repos/index.ts
git commit -m "feat(github): github-repos (list installation repositories)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `github-link-repo` — link repo→project + backfill, and the owner setup doc

**Files:**
- Create: `supabase/functions/github-link-repo/index.ts`
- Create: `docs/superpowers/github-app-setup.md`

**Interfaces:**
- Consumes: `getInstallationToken`, `listOpenIssues` (Task 1).
- Frontend contract: `invokeEdge('github-link-repo', { projectId, repoId, repoFullName, defaultBranch })` → `{ ok, repo, issuesImported }` or `{ error }`.

- [ ] **Step 1: Write `github-link-repo/index.ts`**

```ts
// github-link-repo — authenticated. Links a repo to a project (one repo per account) and
// backfills its open issues into github_issue_cards. Secrets: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY.
// Deploy: supabase functions deploy github-link-repo
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { getInstallationToken, listOpenIssues } from '../_shared/git-provider/githubApi.ts'

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

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
```

- [ ] **Step 2: Deploy (compile gate)**

Deploy `github-link-repo` via the Supabase MCP `deploy_edge_function`. Expected: success.

- [ ] **Step 3: Write the owner setup doc**

Create `docs/superpowers/github-app-setup.md`:

```markdown
# GitHub integration — owner setup & verification

## 1. Register the GitHub App
- GitHub → Settings → Developer settings → GitHub Apps → New App.
- Permissions: **Issues: Read-only**, **Metadata: Read-only**, **Contents: Read-only**.
- Subscribe to events: **Installation**, **Installation repositories**, **Issues**, **Push**.
- Webhook URL: `https://zbipqfsqxnvrzhpdjvvy.functions.supabase.co/github-webhook`; set a Webhook secret.
- Setup URL (post-install redirect): `https://app.loomlance.com/profile?tab=integrations`.
- Note the numeric **App ID**. Generate + download a **private key** (PKCS#1 PEM).

## 2. Convert the key to PKCS#8 and set secrets
```bash
openssl pkcs8 -topk8 -nocrypt -in app.private-key.pem -out app.pk8.pem
supabase secrets set \
  GITHUB_APP_ID=<numeric app id> \
  GITHUB_APP_PRIVATE_KEY="$(cat app.pk8.pem)" \
  GITHUB_WEBHOOK_SECRET=<the webhook secret>
```
(`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected — do not set them.)

## 3. Deploy the functions (honors config.toml verify_jwt)
```bash
supabase functions deploy github-webhook
supabase functions deploy github-connect
supabase functions deploy github-repos
supabase functions deploy github-link-repo
```

## 4. Verify the connect flow (after Plan 2d ships the UI, or via curl with a user JWT)
- Install the App on a test repo → you're redirected to `/profile?tab=integrations?installation_id=...`.
- The Integrations tab calls `github-connect` → a `github_installations` row appears for your user.
- `github-repos` lists the repo; linking it calls `github-link-repo` → a `project_repos` row + the repo's open issues appear in `github_issue_cards` (the board's Issues lane).
- Then the webhook (Plan 2b, `docs/superpowers/github-webhook-verify.md`) keeps issues + commit-completions in sync.
```

- [ ] **Step 4: Verify no BOM + commit**

```bash
for f in supabase/functions/github-link-repo/index.ts docs/superpowers/github-app-setup.md; do printf '%s: ' "$f"; head -c3 "$f" | od -An -tx1; done
git add supabase/functions/github-link-repo/index.ts docs/superpowers/github-app-setup.md
git commit -m "feat(github): github-link-repo (link + issue backfill) + owner setup doc

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- `createAppJwt` produces a verifiable RS256 App JWT (unit-tested, incl. `\n`-escaped PEM); the REST helpers compile and deploy.
- `github-connect`/`github-repos`/`github-link-repo` deploy cleanly (`verify_jwt = true`), follow the canonical auth pattern, write installations/links with the user-scoped client and backfill issue cards with the service-role client, and enforce one-repo-per-account.
- `config.toml` pins the three functions; no BOM; full Vitest suite green.
- The owner setup doc (`docs/superpowers/github-app-setup.md`) covers App registration, the PKCS#8 conversion, secrets, deploy, and the connect-flow verification.

**Plan 2d** (frontend) adds the **Integrations** tab (Connect button → GitHub App install URL with the `/profile?tab=integrations` redirect; linked-repo management calling these functions), the read-only **issues lane** in the kanban (querying `github_issue_cards`, filtered `state = 'open'`), the **scope toggle** (`profiles.commit_completion_scope`), and surfacing `commit_unmatched_ref` notifications — then strip the GitHub "(soon)" markers from the splash.
