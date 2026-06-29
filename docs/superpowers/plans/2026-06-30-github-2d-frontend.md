# GitHub Integration — Plan 2d: Frontend (Integrations tab + issues lane + scope toggle)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the GitHub integration into the UI — connect a GitHub account, link a repo to a project, show its open issues as a read-only kanban lane, and toggle the commit-completion scope. This completes the feature.

**Architecture:** A data layer (`src/api/github.js` + `src/hooks/useGithub.js`) reads `github_installations` / `project_repos` / `github_issue_cards` directly via the RLS-scoped `supabase` client and calls the `github-connect`/`github-repos`/`github-link-repo` Edge Functions via `invokeEdge`. A new **Integrations** profile tab handles the App-install redirect (with a CSRF `state` nonce) and the scope toggle. A per-project **`ProjectGithubBar`** links a repo + shows status. A read-only **`GithubIssuesColumn`** renders the open-issue mirror in the board. The existing generic `NotificationBell` surfaces `commit_unmatched_ref` with no changes.

**Tech Stack:** React + Vite, TanStack Query, Tailwind/Slate Pro, Impeccable for UI craft.

**Why this is Plan 2d:** It's the last piece. 2a (data + parser) / 2b (webhook) / 2c (connect flow) are merged. After this, the GitHub "(soon)" markers come off the splash (a go-live step, gated on the owner registering the App).

## Global Constraints

- **UI:** all components follow the Slate Pro design system and the Impeccable skill guidance (a design hook auto-scans edited UI files). Mirror the existing patterns: profile tabs like `PaymentsTab` (`<div className="max-w-xl space-y-4">` of `<Card>`s), board columns like `KanbanColumn` (`w-72 shrink-0 ...`). Body text ≥4.5:1 contrast.
- **Data:** RLS-accessible reads go directly through `supabase.from(...)` (mirror `src/api/projects.js`); GitHub-API actions go through `invokeEdge('github-connect'|'github-repos'|'github-link-repo', body)` (mirror `PaymentsTab` `connectReal`). Errors surface via `toast.error(e.userMessage || '...')`.
- **Scope values:** `profiles.commit_completion_scope` ∈ `'project'` | `'cross_project'` (default `'project'`).
- **Env:** the App slug comes from `import.meta.env.VITE_GITHUB_APP_SLUG` with a safe `|| ''` default (the app must still boot when unset). Add it to `.env.example`.
- **Install redirect:** `https://github.com/apps/<slug>/installations/new?state=<nonce>`; the nonce is a `crypto.randomUUID()` stored in `sessionStorage` (`gh_install_state`) and verified on return (CSRF). GitHub redirects back to the App's configured Setup URL → `/profile?tab=integrations&installation_id=...&state=...`.
- **Notifications:** no work — `NotificationBell` (`src/components/layout/NotificationBell.jsx:53-65`) renders any kind from `payload.title`/`payload.body`/`link_to`.
- **No UTF-8 BOM**; commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT push (gated). No deploy (frontend).
- **Verify:** `npm run lint` (0 errors), `npm run build` (succeeds), `npm run test:run` (green). UI tasks have no component test harness — verify by lint + build + reasoning + the design hook; note manual checks.

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/github.js` | `GITHUB_APP_SLUG`, `buildInstallUrl`, `githubInstallUrl` | Create |
| `src/lib/__tests__/github.test.js` | unit test for `buildInstallUrl` | Create |
| `src/api/github.js` | reads (installation/repo/issues) + edge calls | Create |
| `src/hooks/useGithub.js` | TanStack hooks/mutations | Create |
| `.env.example` | add `VITE_GITHUB_APP_SLUG` | Modify |
| `src/features/profile/IntegrationsTab.jsx` | connect flow + scope toggle | Create |
| `src/pages/ProfilePage.jsx` | add the Integrations tab | Modify |
| `src/features/github/ProjectGithubBar.jsx` | per-project link/status | Create |
| `src/pages/ProjectDetailPage.jsx` | render the bar | Modify |
| `src/features/kanban/GithubIssuesColumn.jsx` | read-only issues lane | Create |
| `src/features/kanban/KanbanBoard.jsx` | render the lane when linked | Modify |

---

### Task 1: Data layer — `src/lib/github.js`, `src/api/github.js`, `src/hooks/useGithub.js`, env

**Files:**
- Create: `src/lib/github.js`, `src/lib/__tests__/github.test.js`, `src/api/github.js`, `src/hooks/useGithub.js`
- Modify: `.env.example`

**Interfaces:**
- Produces: `GITHUB_APP_SLUG`, `buildInstallUrl(slug, nonce)`, `githubInstallUrl(nonce)`; `api.getInstallation/getProjectRepo/listIssueCards/disconnectRepo/connectInstallation/listRepos/linkRepo`; hooks `useGithubInstallation/useProjectRepo/useGithubIssues/useConnectGithub/useLinkRepo/useDisconnectRepo`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/github.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildInstallUrl } from '@/lib/github'

describe('buildInstallUrl', () => {
  it('builds the GitHub App install URL with an encoded state nonce', () => {
    expect(buildInstallUrl('loomlance', 'abc-123')).toBe(
      'https://github.com/apps/loomlance/installations/new?state=abc-123',
    )
  })
  it('encodes special characters in the nonce', () => {
    expect(buildInstallUrl('loomlance', 'a/b c')).toBe(
      'https://github.com/apps/loomlance/installations/new?state=a%2Fb%20c',
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/lib/__tests__/github.test.js`
Expected: FAIL — cannot resolve `@/lib/github`.

- [ ] **Step 3: Implement `src/lib/github.js`**

```js
// GitHub App install URL + slug config. The slug is owner-set (VITE_GITHUB_APP_SLUG);
// the app must still boot when it's unset (|| '').
export const GITHUB_APP_SLUG = import.meta.env.VITE_GITHUB_APP_SLUG || ''

export function buildInstallUrl(slug, nonce) {
  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(nonce)}`
}

export function githubInstallUrl(nonce) {
  return buildInstallUrl(GITHUB_APP_SLUG, nonce)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/lib/__tests__/github.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the API module `src/api/github.js`**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { invokeEdge } from '@/api/edge'

// --- Reads (RLS-scoped to the current user) ---
export async function getInstallation() {
  const { data, error } = await supabase
    .from('github_installations')
    .select('installation_id, account_login, account_type')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw mapPostgresError(error)
  return data
}

export async function getProjectRepo(projectId) {
  const { data, error } = await supabase
    .from('project_repos')
    .select('repo_full_name, repo_id, default_branch')
    .eq('project_id', projectId)
    .is('disconnected_at', null)
    .maybeSingle()
  if (error) throw mapPostgresError(error)
  return data
}

export async function listIssueCards(projectId) {
  const { data, error } = await supabase
    .from('github_issue_cards')
    .select('id, issue_number, title, html_url, labels, assignee_login')
    .eq('project_id', projectId)
    .eq('state', 'open')
    .order('issue_number', { ascending: true })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function disconnectRepo(projectId) {
  const { error } = await supabase
    .from('project_repos')
    .update({ disconnected_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .is('disconnected_at', null)
  if (error) throw mapPostgresError(error)
}

// --- GitHub-API actions via Edge Functions ---
export const connectInstallation = (installationId) => invokeEdge('github-connect', { installationId })
export const listRepos = () => invokeEdge('github-repos', {})
export const linkRepo = (payload) => invokeEdge('github-link-repo', payload)
```

- [ ] **Step 6: Create the hooks `src/hooks/useGithub.js`**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/github'

export function useGithubInstallation() {
  return useQuery({ queryKey: ['github', 'installation'], queryFn: api.getInstallation })
}
export function useProjectRepo(projectId) {
  return useQuery({
    queryKey: ['github', 'project-repo', projectId],
    queryFn: () => api.getProjectRepo(projectId),
    enabled: !!projectId,
  })
}
export function useGithubIssues(projectId) {
  return useQuery({
    queryKey: ['github', 'issues', projectId],
    queryFn: () => api.listIssueCards(projectId),
    enabled: !!projectId,
  })
}
export function useConnectGithub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.connectInstallation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['github', 'installation'] }),
  })
}
export function useLinkRepo(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.linkRepo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github', 'project-repo', projectId] })
      qc.invalidateQueries({ queryKey: ['github', 'issues', projectId] })
    },
  })
}
export function useDisconnectRepo(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.disconnectRepo(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github', 'project-repo', projectId] })
      qc.invalidateQueries({ queryKey: ['github', 'issues', projectId] })
    },
  })
}
```

- [ ] **Step 7: Add the env var**

In `.env.example`, add a line:
```
VITE_GITHUB_APP_SLUG=your-github-app-slug
```

- [ ] **Step 8: Verify + commit**

Run: `npm run test:run` (full suite green), `npm run lint` (0 errors).
```bash
for f in src/lib/github.js src/api/github.js src/hooks/useGithub.js; do printf '%s: ' "$f"; head -c3 "$f" | od -An -tx1; done
git add src/lib/github.js src/lib/__tests__/github.test.js src/api/github.js src/hooks/useGithub.js .env.example
git commit -m "feat(github): frontend data layer (api + hooks + install url)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Integrations tab — connect GitHub + scope toggle

**Files:**
- Create: `src/features/profile/IntegrationsTab.jsx`
- Modify: `src/pages/ProfilePage.jsx`

**Interfaces:**
- Consumes: `useGithubInstallation`, `useConnectGithub` (Task 1); `useProfile`, `useUpdateProfile`; `githubInstallUrl`, `GITHUB_APP_SLUG`; `invokeEdge` indirectly.

- [ ] **Step 1: Build `IntegrationsTab`**

Create `src/features/profile/IntegrationsTab.jsx`. Follow the `PaymentsTab` shell (`<div className="max-w-xl space-y-4">` of `<Card>`s) and the `SubscriptionTab` redirect-back pattern. Use `@/components/ui/{Card,Button,Badge}`, `sonner` `toast`, `react-router-dom` `useSearchParams`/`useNavigate`.

```jsx
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useGithubInstallation, useConnectGithub } from '@/hooks/useGithub'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { GITHUB_APP_SLUG, githubInstallUrl } from '@/lib/github'

const SCOPES = [
  { value: 'project', title: 'Project-scoped', desc: 'A commit only completes tasks in the project its repo is linked to (with typo correction).' },
  { value: 'cross_project', title: 'Cross-project', desc: 'A commit can complete tasks in any of your projects by their key (exact key match).' },
]

export function IntegrationsTab() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: installation } = useGithubInstallation()
  const connect = useConnectGithub()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [connecting, setConnecting] = useState(false)

  // Handle the post-install redirect (?installation_id=&state=).
  useEffect(() => {
    const installationId = params.get('installation_id')
    if (!installationId) return
    const state = params.get('state')
    const expected = sessionStorage.getItem('gh_install_state')
    sessionStorage.removeItem('gh_install_state')
    // Always clear the params so a refresh doesn't re-run.
    const clear = () => navigate('/profile?tab=integrations', { replace: true })
    if (!expected || state !== expected) {
      toast.error('GitHub connection could not be verified. Please try again.')
      clear()
      return
    }
    connect.mutateAsync(installationId)
      .then((r) => toast.success(`Connected to GitHub${r?.account ? ` (@${r.account})` : ''}`))
      .catch((e) => toast.error(e.userMessage || 'Could not connect GitHub'))
      .finally(clear)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const startConnect = () => {
    if (!GITHUB_APP_SLUG) { toast.error('GitHub integration is not configured yet.'); return }
    setConnecting(true)
    const nonce = crypto.randomUUID()
    sessionStorage.setItem('gh_install_state', nonce)
    window.location.href = githubInstallUrl(nonce)
  }

  const setScope = async (value) => {
    try {
      await updateProfile.mutateAsync({ commit_completion_scope: value })
      toast.success('Commit-completion scope updated')
    } catch (e) {
      toast.error(e.userMessage || 'Could not update the setting')
    }
  }

  const scope = profile?.commit_completion_scope || 'project'

  return (
    <div className="max-w-xl space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">GitHub</h3>
          {installation ? <Badge variant="success">Connected</Badge> : null}
        </div>
        {installation ? (
          <p className="text-sm text-fg-muted">
            Connected{installation.account_login ? ` as @${installation.account_login}` : ''}. Link a repository to a project from that project&apos;s page.
          </p>
        ) : (
          <>
            <p className="text-sm text-fg-muted">
              Connect GitHub to mirror a repo&apos;s open issues onto your board and complete tasks from commit messages (e.g. <code className="rounded bg-bg-muted px-1">KEY-123 done</code>).
            </p>
            <Button onClick={startConnect} loading={connecting}>Connect GitHub</Button>
          </>
        )}
      </Card>

      {installation ? (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-fg">Commit completion scope</h3>
          <div className="space-y-2">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setScope(s.value)}
                aria-pressed={scope === s.value}
                className={`block w-full rounded-lg border p-3 text-left transition-colors ${scope === s.value ? 'border-primary bg-primary/5' : 'border-border hover:border-border-strong'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-fg">{s.title}</span>
                  {s.value === 'project' ? <span className="text-xs text-fg-subtle">Default</span> : null}
                </div>
                <p className="mt-1 text-xs text-fg-muted">{s.desc}</p>
              </button>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Wire the tab into `ProfilePage`**

In `src/pages/ProfilePage.jsx`: import `IntegrationsTab`; add `{ key: 'integrations', label: 'Integrations' }` to the `TABS` array (after `payments`); add `{tab === 'integrations' && <IntegrationsTab />}` in the render block.

- [ ] **Step 3: Verify + commit**

Run `npm run lint` (0 errors) and `npm run build` (succeeds). The design hook will scan `IntegrationsTab` — address any deterministic findings. Manual check noted: connecting requires the deployed App (owner step); without `VITE_GITHUB_APP_SLUG` the Connect button shows the "not configured" toast.
```bash
printf 'IntegrationsTab: '; head -c3 src/features/profile/IntegrationsTab.jsx | od -An -tx1
git add src/features/profile/IntegrationsTab.jsx src/pages/ProfilePage.jsx
git commit -m "feat(github): Integrations tab (connect + scope toggle)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `ProjectGithubBar` — link a repo to a project

**Files:**
- Create: `src/features/github/ProjectGithubBar.jsx`
- Modify: `src/pages/ProjectDetailPage.jsx`

**Interfaces:**
- Consumes: `useGithubInstallation`, `useProjectRepo`, `useLinkRepo`, `useDisconnectRepo` (Task 1); `listRepos` via `invokeEdge`; the project's `task_key`.

- [ ] **Step 1: Build `ProjectGithubBar`**

Create `src/features/github/ProjectGithubBar.jsx`. Renders nothing if there's no GitHub installation. If installed but no repo linked → a "Connect a repository" control that loads the installation's repos (`listRepos`) into a `Select` and links the chosen one. If linked → shows the repo + a commit hint + a disconnect action.

```jsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Github, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { listRepos } from '@/api/github'
import { useGithubInstallation, useProjectRepo, useLinkRepo, useDisconnectRepo } from '@/hooks/useGithub'
import { taskRef } from '@/lib/taskRef'

export function ProjectGithubBar({ project }) {
  const projectId = project.id
  const { data: installation } = useGithubInstallation()
  const { data: repo } = useProjectRepo(projectId)
  const link = useLinkRepo(projectId)
  const disconnect = useDisconnectRepo(projectId)
  const [repos, setRepos] = useState(null) // null = not loaded, [] = loaded empty
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState(false)

  if (!installation) return null

  const openPicker = async () => {
    setPicking(true)
    if (repos) return
    setLoading(true)
    try {
      const r = await listRepos()
      setRepos(r?.repos || [])
    } catch (e) {
      toast.error(e.userMessage || 'Could not load repositories')
      setPicking(false)
    } finally {
      setLoading(false)
    }
  }

  const onPick = async (e) => {
    const repoId = e.target.value
    if (!repoId) return
    const chosen = (repos || []).find((x) => String(x.id) === String(repoId))
    if (!chosen) return
    try {
      const res = await link.mutateAsync({
        projectId,
        repoId: chosen.id,
        repoFullName: chosen.full_name,
        defaultBranch: chosen.default_branch,
      })
      toast.success(`Linked ${chosen.full_name}${res?.issuesImported ? ` · ${res.issuesImported} issues imported` : ''}`)
      setPicking(false)
    } catch (err) {
      toast.error(err.userMessage || 'Could not link the repository')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-elevated p-3 text-sm">
      <Github className="size-4 text-fg-muted" />
      {repo ? (
        <>
          <span className="font-medium text-fg">{repo.repo_full_name}</span>
          <span className="text-fg-muted">
            Commits like <code className="rounded bg-bg-muted px-1">{taskRef(project.task_key, 1)} done</code> complete tasks; open issues show in the board.
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => disconnect.mutate(undefined, { onSuccess: () => toast.success('Repository disconnected') })} loading={disconnect.isPending}>
            <X className="size-4" /> Disconnect
          </Button>
        </>
      ) : picking ? (
        <Select onChange={onPick} defaultValue="" disabled={loading} className="max-w-xs">
          <option value="" disabled>{loading ? 'Loading…' : 'Choose a repository'}</option>
          {(repos || []).map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
        </Select>
      ) : (
        <>
          <span className="text-fg-muted">Link a GitHub repository to mirror its issues and complete tasks from commits.</span>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={openPicker}>Connect a repository</Button>
        </>
      )}
    </div>
  )
}
```

(If `Select` doesn't accept `size`/`className` exactly as written, adapt to its real props — check `src/components/ui/Select.jsx`. If `Button` has no `size="sm"`, drop it.)

- [ ] **Step 2: Render it on the project page**

In `src/pages/ProjectDetailPage.jsx`: import `ProjectGithubBar`; render `<ProjectGithubBar project={project} />` between `<ProjectFinancialsPanel project={project} />` and `<KanbanBoard ... />`.

- [ ] **Step 3: Verify + commit**

`npm run lint`, `npm run build`. Address design-hook findings. Manual note: requires a connected installation + deployed functions (owner).
```bash
printf 'ProjectGithubBar: '; head -c3 src/features/github/ProjectGithubBar.jsx | od -An -tx1
git add src/features/github/ProjectGithubBar.jsx src/pages/ProjectDetailPage.jsx
git commit -m "feat(github): per-project repo link bar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `GithubIssuesColumn` — read-only issues lane on the board

**Files:**
- Create: `src/features/kanban/GithubIssuesColumn.jsx`
- Modify: `src/features/kanban/KanbanBoard.jsx`

**Interfaces:**
- Consumes: `useGithubIssues`, `useProjectRepo` (Task 1).

- [ ] **Step 1: Build `GithubIssuesColumn`**

Create `src/features/kanban/GithubIssuesColumn.jsx`. Mirror the `KanbanColumn` shell (`w-72 shrink-0 flex-col self-start rounded-lg bg-bg-elevated p-3 snap-start`) but read-only — open issues as linked cards.

```jsx
import { Github, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useGithubIssues } from '@/hooks/useGithub'

export function GithubIssuesColumn({ projectId }) {
  const { data: issues = [] } = useGithubIssues(projectId)
  return (
    <div className="flex w-72 shrink-0 flex-col self-start rounded-lg bg-bg-elevated p-3 snap-start ring-1 ring-border/60">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Github className="size-4 text-fg-muted" />
        <h3 className="truncate text-sm font-medium">GitHub Issues</h3>
        <Badge>{issues.length}</Badge>
      </div>
      <div className="flex min-h-[100px] flex-col gap-2">
        {issues.map((i) => (
          <a
            key={i.id}
            href={i.html_url || '#'}
            target="_blank"
            rel="noreferrer"
            className="group rounded-md border border-border bg-bg p-3 text-sm hover:border-border-strong"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-snug">{i.title}</p>
              <ExternalLink className="size-3.5 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span className="font-mono">#{i.issue_number}</span>
              {(i.labels || []).map((l) => (
                <span key={l} className="rounded-full bg-bg-muted px-2 py-0.5">{l}</span>
              ))}
              {i.assignee_login ? <span>@{i.assignee_login}</span> : null}
            </div>
          </a>
        ))}
        {issues.length === 0 ? <p className="px-1 text-xs text-fg-subtle">No open issues.</p> : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Render the lane in `KanbanBoard` when a repo is linked**

In `src/features/kanban/KanbanBoard.jsx`:
1. Add imports:
```js
import { useProjectRepo } from '@/hooks/useGithub'
import { GithubIssuesColumn } from './GithubIssuesColumn'
```
2. Inside `KanbanBoard`, add: `const { data: linkedRepo } = useProjectRepo(projectId)`.
3. In the columns row, after `<AddColumn projectId={projectId} position={columns.length} />` and before the closing `</div>`, add:
```jsx
            {linkedRepo ? <GithubIssuesColumn projectId={projectId} /> : null}
```

- [ ] **Step 3: Verify + commit**

`npm run lint`, `npm run build`. Address design-hook findings. Manual note: the lane only renders when a repo is linked (which needs the owner-deployed functions); seed a `github_issue_cards` row in dev to preview.
```bash
printf 'GithubIssuesColumn: '; head -c3 src/features/kanban/GithubIssuesColumn.jsx | od -An -tx1
git add src/features/kanban/GithubIssuesColumn.jsx src/features/kanban/KanbanBoard.jsx
git commit -m "feat(github): read-only issues lane on the board

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- The data layer reads installation/repo/issues (RLS) and calls the connect/repos/link edge functions; `buildInstallUrl` is unit-tested.
- The **Integrations** profile tab connects GitHub (CSRF-nonce'd install redirect → `github-connect`) and toggles `commit_completion_scope`.
- The project page shows a **`ProjectGithubBar`** to link/disconnect a repo (with the commit hint); the board shows a read-only **GitHub Issues** lane when a repo is linked.
- `commit_unmatched_ref` notifications render automatically (no NotificationBell change).
- `npm run lint`, `npm run test:run`, `npm run build` all pass; no BOM; design-hook findings addressed.

**Go-live (after the owner registers the App + deploys + sets `VITE_GITHUB_APP_SLUG`):** verify the full connect→link→commit→complete loop (`github-app-setup.md` + `github-webhook-verify.md`), then **strip the GitHub "(soon)" markers from the splash** (`pricing.html` Freelancer item, `index.html`/FAQ "GitHub/GitLab integration") — dual-home: the roadmap item is delivered. This is a splash-repo edit, gated on the feature being live for users.
