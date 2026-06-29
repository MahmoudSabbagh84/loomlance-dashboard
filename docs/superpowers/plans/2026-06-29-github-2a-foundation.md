# GitHub Integration — Plan 2a: Foundation (data model + commit parser/resolver)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the GitHub-integration foundation — the four connection/data tables, the per-user `commit_completion_scope` toggle, and the pure, fully-tested smart-commit **parser + resolver** — with no GitHub calls yet.

**Architecture:** A DB migration adds 4 RLS-protected tables (`github_installations`, `project_repos`, `github_issue_cards`, `github_events`) and a `profiles.commit_completion_scope` column. A single pure TypeScript module `supabase/functions/_shared/git-provider/commitParse.ts` holds `parseCommit` (commit message → normalized task refs) and `resolveRefs` (refs + projects + mode → tasks to complete / unmatched), unit-tested by Vitest (the Edge Function webhook in Plan 2b imports the same module).

**Tech Stack:** Supabase Postgres (migrations via Supabase MCP `apply_migration`), Deno/TypeScript Edge modules, Vitest.

**Why this is Plan 2a:** It's the testable spine with zero external dependencies. Plan 2b (GitHub App + `github-webhook`) consumes `commitParse.ts` and writes these tables; Plan 2c is the frontend. See `docs/superpowers/specs/2026-06-28-github-issue-sync-design.md`.

## Global Constraints

- **DB is hosted Supabase** `zbipqfsqxnvrzhpdjvvy` — apply migrations via the Supabase MCP `apply_migration` tool **and** save identical SQL to a local file under `supabase/migrations/`. No local Docker.
- **RLS convention:** every user-owned table uses policies named `<table>_<verb>_own` with `using (user_id = auth.uid())` / `with check (user_id = auth.uid())` (mirror `clients`). Tables written only by the webhook use `service_role` (RLS bypass) and get no insert/update/delete policies.
- **Scope toggle values:** `commit_completion_scope` ∈ `('project','cross_project')`, default `'project'`.
- **Parser/resolver is PURE** — no Deno or Supabase imports in `commitParse.ts`, so Vitest can run it directly.
- **Completion keywords** (case-insensitive, with curated misspellings): `done, complete, completed, close, closes, closed, fix, fixes, fixed, resolve, resolves, resolved` + `doen, donne, completd, compelted, clsoe, cloes, fixs, resloves, resoled`.
- **A task ref** is `\b([A-Za-z]{2,5})[-\s#]0*(\d+)\b`, normalized to `{ key: UPPERCASE, number: int }`; a ref counts only if the message also contains a keyword; refs whose key is itself a keyword are discarded (so GitHub `Closes #5`/`Fixes #12` are NOT task refs).
- **File encoding:** use the Edit/Write tools normally but verify no UTF-8 BOM is introduced (`head -c3 <file>` must not be `ef bb bf`).
- **Commits:** end every message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT push (gated).
- **Test/lint/build:** `npm run test:run`, `npm run lint`, `npm run build`.

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/20260630000000_github_foundation.sql` | 4 tables + RLS + `commit_completion_scope` | Create |
| `supabase/functions/_shared/git-provider/commitParse.ts` | `parseCommit`, `hasKeyword`, `levenshtein`, `resolveRefs` (pure) | Create |
| `supabase/functions/_shared/git-provider/commitParse.test.ts` | Vitest unit tests for the above | Create |
| `vite.config.js` | Extend `test.include` to scan `supabase/functions/**` test files | Modify |

---

### Task 1: Migration — connection tables + scope toggle

**Files:**
- Create: `supabase/migrations/20260630000000_github_foundation.sql`

**Interfaces:**
- Produces: tables `github_installations`, `project_repos` (unique `project_id`), `github_issue_cards` (unique `(project_id, issue_number)`, select-own only), `github_events` (pk `delivery_id`, no user policies); `profiles.commit_completion_scope` (default `'project'`, check).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260630000000_github_foundation.sql` with exactly:

```sql
-- GitHub integration foundation: connection tables + commit-completion scope toggle.

-- Per-user smart-commit resolution scope.
alter table public.profiles
  add column if not exists commit_completion_scope text not null default 'project'
    check (commit_completion_scope in ('project', 'cross_project'));

-- GitHub App installations (one row per installation the user authorized).
create table public.github_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id bigint not null unique,
  account_login text,
  account_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.github_installations enable row level security;
create policy "github_installations_select_own" on public.github_installations for select using (user_id = auth.uid());
create policy "github_installations_insert_own" on public.github_installations for insert with check (user_id = auth.uid());
create policy "github_installations_update_own" on public.github_installations for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "github_installations_delete_own" on public.github_installations for delete using (user_id = auth.uid());

-- One repo linked per project (the link drives the issues lane).
create table public.project_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  installation_id bigint not null,
  repo_id bigint not null,
  repo_full_name text not null,
  default_branch text not null default 'main',
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz
);
alter table public.project_repos enable row level security;
create policy "project_repos_select_own" on public.project_repos for select using (user_id = auth.uid());
create policy "project_repos_insert_own" on public.project_repos for insert with check (user_id = auth.uid());
create policy "project_repos_update_own" on public.project_repos for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "project_repos_delete_own" on public.project_repos for delete using (user_id = auth.uid());

-- Read-only mirror of OPEN GitHub issues (rendered in the board's Issues lane).
-- Writes come from the webhook (service_role); users only read their own rows.
create table public.github_issue_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  repo_id bigint not null,
  issue_number integer not null,
  title text not null,
  state text not null default 'open',
  html_url text,
  labels jsonb not null default '[]'::jsonb,
  assignee_login text,
  github_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (project_id, issue_number)
);
alter table public.github_issue_cards enable row level security;
create policy "github_issue_cards_select_own" on public.github_issue_cards for select using (user_id = auth.uid());
-- no insert/update/delete policies: service_role (webhook) only.

-- Webhook delivery idempotency (service_role only; RLS on, no policies -> users have no access).
create table public.github_events (
  delivery_id text primary key,
  event_type text,
  received_at timestamptz not null default now()
);
alter table public.github_events enable row level security;
```

- [ ] **Step 2: Apply the migration to the hosted DB**

Use the Supabase MCP `apply_migration` tool with `name: "github_foundation"` and the SQL body from Step 1. Expected: success.

- [ ] **Step 3: Verify structure**

Use the Supabase MCP `execute_sql` tool:

```sql
select table_name from information_schema.tables
  where table_schema='public'
    and table_name in ('github_installations','project_repos','github_issue_cards','github_events')
  order by table_name;
select column_name, column_default from information_schema.columns
  where table_schema='public' and table_name='profiles' and column_name='commit_completion_scope';
select polname, tablename from pg_policies
  where schemaname='public' and tablename like 'github_%' or tablename='project_repos'
  order by tablename, polname;
```
Expected: all 4 tables present; `commit_completion_scope` default `'project'`; policies present for installations/project_repos (4 each), `github_issue_cards_select_own` (1), and none for `github_events`.

- [ ] **Step 4: Verify the scope-toggle check constraint**

Run each statement as a SEPARATE `execute_sql` call (the `'bogus'` one is expected to raise an error and would otherwise abort a batched transaction):

```sql
-- valid value accepted
update public.profiles set commit_completion_scope='cross_project' where id=(select id from public.profiles limit 1);
-- invalid value rejected (this statement MUST error)
update public.profiles set commit_completion_scope='bogus' where id=(select id from public.profiles limit 1);
-- reset
update public.profiles set commit_completion_scope='project' where id=(select id from public.profiles limit 1);
```
Expected: the `'cross_project'` update succeeds; the `'bogus'` update raises a check-constraint violation; reset succeeds. Report the actual outcomes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260630000000_github_foundation.sql
git commit -m "feat(db): GitHub integration foundation tables + commit-scope toggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `parseCommit` — commit message → normalized task refs

**Files:**
- Create: `supabase/functions/_shared/git-provider/commitParse.ts`
- Create: `supabase/functions/_shared/git-provider/commitParse.test.ts`
- Modify: `vite.config.js` (extend `test.include`)

**Interfaces:**
- Produces: `hasKeyword(message: string): boolean`; `parseCommit(message: string): Array<{ key: string; number: number }>` — uppercase key, integer number, deduped; `[]` when no keyword, no ref, or every ref's key is itself a keyword.

- [ ] **Step 1: Extend Vitest to scan `supabase/functions`**

In `vite.config.js`, change the `test.include` line from:
```js
    include: ['src/**/*.{test,spec}.{js,jsx}'],
```
to:
```js
    include: ['src/**/*.{test,spec}.{js,jsx}', 'supabase/functions/**/*.{test,spec}.{ts,js}'],
```

- [ ] **Step 2: Write the failing test**

Create `supabase/functions/_shared/git-provider/commitParse.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseCommit, hasKeyword } from './commitParse'

describe('hasKeyword', () => {
  it('detects keywords case-insensitively and in (parens)/[brackets]', () => {
    expect(hasKeyword('all DONE here')).toBe(true)
    expect(hasKeyword('LLM-3 (done)')).toBe(true)
    expect(hasKeyword('just some wip')).toBe(false)
    expect(hasKeyword("I dont know")).toBe(false) // 'dont' is not a keyword
  })
})

describe('parseCommit', () => {
  it('extracts a ref when a completion keyword is present', () => {
    expect(parseCommit('LLM-3 done')).toEqual([{ key: 'LLM', number: 3 }])
  })
  it('returns [] with no keyword', () => {
    expect(parseCommit('LLM-3 wip')).toEqual([])
  })
  it('returns [] with a keyword but no ref', () => {
    expect(parseCommit('done with everything')).toEqual([])
  })
  it('normalizes case, separators, and zero-padding', () => {
    expect(parseCommit('done llm-003')).toEqual([{ key: 'LLM', number: 3 }])
    expect(parseCommit('LLM 3 closes')).toEqual([{ key: 'LLM', number: 3 }])
    expect(parseCommit('LLM#3 fixed')).toEqual([{ key: 'LLM', number: 3 }])
  })
  it('handles (done) and [done] forms', () => {
    expect(parseCommit('LLM-3 (done)')).toEqual([{ key: 'LLM', number: 3 }])
    expect(parseCommit('LLM-3 [done]')).toEqual([{ key: 'LLM', number: 3 }])
  })
  it('accepts curated misspellings', () => {
    expect(parseCommit('LLM-3 doen')).toEqual([{ key: 'LLM', number: 3 }])
    expect(parseCommit('API-7 clsoe')).toEqual([{ key: 'API', number: 7 }])
  })
  it('does NOT treat GitHub Closes/Fixes #N as a task ref', () => {
    expect(parseCommit('Closes #5')).toEqual([])
    expect(parseCommit('Fixes #12')).toEqual([])
  })
  it('ignores GitHub #N but captures a real task ref in the same message', () => {
    expect(parseCommit('Fixes #12, LLM-3 done')).toEqual([{ key: 'LLM', number: 3 }])
  })
  it('dedupes repeats and collects multiple distinct refs', () => {
    expect(parseCommit('done LLM-3 and API-7 and LLM-3')).toEqual([
      { key: 'LLM', number: 3 },
      { key: 'API', number: 7 },
    ])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:run -- commitParse`
Expected: FAIL — cannot resolve `./commitParse` (module does not exist).

- [ ] **Step 4: Write the implementation**

Create `supabase/functions/_shared/git-provider/commitParse.ts`:

```ts
// Pure smart-commit parsing/resolution for the GitHub integration.
// No Deno/Supabase imports: Vitest unit-tests this file directly, and the
// github-webhook Edge Function imports it (with the .ts extension) at runtime.

const KEYWORDS: ReadonlySet<string> = new Set([
  'done', 'complete', 'completed', 'close', 'closes', 'closed',
  'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved',
  // curated common misspellings (NOT blind fuzzing — avoids false positives like "dont")
  'doen', 'donne', 'completd', 'compelted', 'clsoe', 'cloes', 'fixs', 'resloves', 'resoled',
])

const WORD_RE = /[a-z]+/g
const REF_RE = /\b([A-Za-z]{2,5})[-\s#]0*(\d+)\b/g

export function hasKeyword(message: string): boolean {
  const lower = String(message ?? '').toLowerCase()
  let m: RegExpExecArray | null
  WORD_RE.lastIndex = 0
  while ((m = WORD_RE.exec(lower)) !== null) {
    if (KEYWORDS.has(m[0])) return true
  }
  return false
}

// Extract normalized { key, number } refs that co-occur with a completion keyword.
// A ref whose key is itself a keyword (e.g. "Fixes #12") is discarded — GitHub's own
// issue-closing syntax must not be treated as a LoomLance task ref.
export function parseCommit(message: string): Array<{ key: string; number: number }> {
  const text = String(message ?? '')
  if (!hasKeyword(text)) return []
  const out: Array<{ key: string; number: number }> = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  REF_RE.lastIndex = 0
  while ((m = REF_RE.exec(text)) !== null) {
    if (KEYWORDS.has(m[1].toLowerCase())) continue
    const key = m[1].toUpperCase()
    const number = parseInt(m[2], 10)
    const id = `${key}-${number}`
    if (!seen.has(id)) {
      seen.add(id)
      out.push({ key, number })
    }
  }
  return out
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- commitParse`
Expected: PASS (all assertions). Then run `npm run test:run` once to confirm the whole suite (now scanning `supabase/functions`) is green with no unexpected collateral.

- [ ] **Step 6: Verify no BOM + commit**

```bash
for f in supabase/functions/_shared/git-provider/commitParse.ts supabase/functions/_shared/git-provider/commitParse.test.ts vite.config.js; do printf '%s: ' "$f"; head -c3 "$f" | od -An -tx1; done
```
Expected: none start with `ef bb bf`.
```bash
git add supabase/functions/_shared/git-provider/commitParse.ts supabase/functions/_shared/git-provider/commitParse.test.ts vite.config.js
git commit -m "feat(github): smart-commit parser (commitParse)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `resolveRefs` — map parsed refs to tasks per the scope mode

**Files:**
- Modify: `supabase/functions/_shared/git-provider/commitParse.ts` (add `levenshtein`, `resolveRefs`)
- Modify: `supabase/functions/_shared/git-provider/commitParse.test.ts` (add tests)

**Interfaces:**
- Consumes: `parseCommit` output `[{ key, number }]`.
- Produces:
  - `levenshtein(a: string, b: string): number`
  - `resolveRefs(refs, opts): { matched: Array<{ projectId: string; key: string; number: number }>; unmatched: Array<{ key: string; number: number }> }` where `opts = { mode: 'project'|'cross_project', linkedProjectId: string|null, projects: Array<{ id: string; task_key: string }> }`. Project-scoped = only the linked project, with fuzzy key correction (Levenshtein ≤1). Cross-project = exact key match against any project. `matched` is deduped by `(projectId, number)`.

- [ ] **Step 1: Write the failing tests**

Add to `commitParse.test.ts` (keep existing imports; extend the import line to also import `resolveRefs, levenshtein`):

```ts
import { parseCommit, hasKeyword, resolveRefs, levenshtein } from './commitParse'

const PROJECTS = [
  { id: 'p-llm', task_key: 'LLM' },
  { id: 'p-api', task_key: 'API' },
]

describe('levenshtein', () => {
  it('measures single-edit distance', () => {
    expect(levenshtein('LLM', 'LLM')).toBe(0)
    expect(levenshtein('LMM', 'LLM')).toBe(1)
    expect(levenshtein('XYZ', 'LLM')).toBe(3)
  })
})

describe('resolveRefs — project-scoped (default)', () => {
  const opts = { mode: 'project', linkedProjectId: 'p-llm', projects: PROJECTS }
  it('matches the linked project by exact key', () => {
    expect(resolveRefs([{ key: 'LLM', number: 3 }], opts)).toEqual({
      matched: [{ projectId: 'p-llm', key: 'LLM', number: 3 }],
      unmatched: [],
    })
  })
  it('fuzzy-corrects a one-edit key typo to the linked project', () => {
    expect(resolveRefs([{ key: 'LMM', number: 3 }], opts)).toEqual({
      matched: [{ projectId: 'p-llm', key: 'LLM', number: 3 }],
      unmatched: [],
    })
  })
  it('does not match another project key in project-scoped mode', () => {
    expect(resolveRefs([{ key: 'API', number: 7 }], opts)).toEqual({
      matched: [],
      unmatched: [{ key: 'API', number: 7 }],
    })
  })
  it('dedupes refs that resolve to the same linked task', () => {
    expect(resolveRefs([{ key: 'LLM', number: 3 }, { key: 'LMM', number: 3 }], opts)).toEqual({
      matched: [{ projectId: 'p-llm', key: 'LLM', number: 3 }],
      unmatched: [],
    })
  })
})

describe('resolveRefs — cross-project', () => {
  const opts = { mode: 'cross_project', linkedProjectId: 'p-llm', projects: PROJECTS }
  it('matches any project by exact key', () => {
    expect(resolveRefs([{ key: 'LLM', number: 3 }, { key: 'API', number: 7 }], opts)).toEqual({
      matched: [
        { projectId: 'p-llm', key: 'LLM', number: 3 },
        { projectId: 'p-api', key: 'API', number: 7 },
      ],
      unmatched: [],
    })
  })
  it('does NOT fuzzy-correct in cross-project mode (typo -> unmatched)', () => {
    expect(resolveRefs([{ key: 'LMM', number: 3 }], opts)).toEqual({
      matched: [],
      unmatched: [{ key: 'LMM', number: 3 }],
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- commitParse`
Expected: FAIL — `resolveRefs`/`levenshtein` are not exported.

- [ ] **Step 3: Implement `levenshtein` + `resolveRefs`**

Append to `supabase/functions/_shared/git-provider/commitParse.ts`:

```ts
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => i)
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i]
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1])
      prev = tmp
    }
  }
  return dp[m]
}

interface ResolveOpts {
  mode: 'project' | 'cross_project'
  linkedProjectId: string | null
  projects: Array<{ id: string; task_key: string }>
}

// Map parsed refs to the tasks they should complete, honoring the user's scope mode.
// Project-scoped: only the repo's linked project, with fuzzy key correction (Levenshtein <= 1).
// Cross-project: exact key match against any of the user's projects (no fuzzy).
// Refs that resolve to no project are returned as `unmatched` (the webhook notifies on these).
export function resolveRefs(
  refs: Array<{ key: string; number: number }>,
  opts: ResolveOpts,
): { matched: Array<{ projectId: string; key: string; number: number }>; unmatched: Array<{ key: string; number: number }> } {
  const matched: Array<{ projectId: string; key: string; number: number }> = []
  const unmatched: Array<{ key: string; number: number }> = []
  const seen = new Set<string>()
  const byKey = new Map(opts.projects.map((p) => [p.task_key, p]))
  const linked = opts.projects.find((p) => p.id === opts.linkedProjectId) ?? null

  const push = (projectId: string, key: string, number: number) => {
    const id = `${projectId}-${number}`
    if (!seen.has(id)) {
      seen.add(id)
      matched.push({ projectId, key, number })
    }
  }

  for (const ref of refs) {
    if (opts.mode === 'cross_project') {
      const proj = byKey.get(ref.key)
      if (proj) push(proj.id, ref.key, ref.number)
      else unmatched.push({ key: ref.key, number: ref.number })
    } else {
      if (linked && (ref.key === linked.task_key || levenshtein(ref.key, linked.task_key) <= 1)) {
        push(linked.id, linked.task_key, ref.number)
      } else {
        unmatched.push({ key: ref.key, number: ref.number })
      }
    }
  }
  return { matched, unmatched }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- commitParse`
Expected: PASS (parser + resolver + levenshtein). Then `npm run test:run` for the whole suite, and `npm run lint`.
Expected: full suite green, lint 0 errors.

- [ ] **Step 5: Verify no BOM + commit**

```bash
printf 'commitParse.ts: '; head -c3 supabase/functions/_shared/git-provider/commitParse.ts | od -An -tx1
git add supabase/functions/_shared/git-provider/commitParse.ts supabase/functions/_shared/git-provider/commitParse.test.ts
git commit -m "feat(github): resolveRefs + levenshtein (scope-aware commit resolution)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- 4 tables + `commit_completion_scope` exist in the hosted DB with correct RLS; the check constraint rejects bad values.
- `commitParse.ts` exports `parseCommit`, `hasKeyword`, `levenshtein`, `resolveRefs`, all unit-tested (parser normalization + keyword/misspelling + GitHub-`#N` exclusion + dedup; resolver project-scoped fuzzy vs cross-project exact + unmatched + dedup).
- `npm run test:run`, `npm run lint`, `npm run build` all pass; no BOM on new files.

**Plan 2b** consumes `commitParse.ts` from the `github-webhook` Edge Function and writes these tables. Open decision deferred to 2b: the webhook moves a completed task to the project's "done" column — reconcile the spec's "terminal (highest-position) column" with the board's runtime rule (`/done/i` name match in `KanbanBoard.jsx:51`); prefer the `/done/i`-named column, falling back to highest position.
