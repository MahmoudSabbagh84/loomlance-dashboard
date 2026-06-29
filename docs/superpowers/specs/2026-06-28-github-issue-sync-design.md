# GitHub Issue Sync + Smart-Commit Task Completion — Design Spec

- **Date:** 2026-06-28
- **Status:** Approved in brainstorm → ready for implementation plan
- **Roadmap item:** "GitHub/GitLab integration" (splash "coming soon"). This spec covers **v1: GitHub only, one-way**. See [[loomlance_roadmap]].

## Summary

Connect a GitHub repository to a LoomLance project so that (1) the project's open GitHub **issues** appear as read-only cards in a board lane that's only present once connected, and (2) **commit messages drive task completion** across the whole board — a commit referencing a task's key (`KEY-123`) plus a completion keyword moves that task to the project's Done column, from any column it's in. A dev's normal `Closes #5` also closes the GitHub issue, which our mirror reflects automatically.

**Why:** It's the flagship developer-first hook — devs already write commits and `Closes #N`; this lets that existing workflow drive their LoomLance board with zero extra ceremony, and reinforces the "do the work, the admin keeps up with you" thesis.

## Scope

**In (v1):**
- GitHub only, behind a `gitProvider` abstraction so GitLab slots in next.
- **GitHub App** auth (read-only): install → grant repos → link **one repo per project**.
- Read-only **GitHub Issues lane** on connected projects (mirrors open issues; updates via webhook).
- **Per-project task keys** (user-set, 2–5 letters) → tasks auto-number `KEY-001`.
- **Smart-commit completion** with a per-user **scope toggle** (Project-scoped default / Cross-project) and typo tolerance: a push whose commit message contains a task ref + completion keyword moves matched task(s) to their project's Done column (board-wide, column-agnostic).
- Webhook-driven real-time sync + initial backfill on link + manual "Resync".

**Out (later versions):**
- GitLab (the abstraction is built; the provider is not).
- Two-way (drag card → close issue; create task → create issue; move task → change issue state).
- Label → column mapping; multiple repos per project; PR/commit activity feed; non-default-branch commit triggers.

## User Flows

1. **Connect GitHub** (Settings → Integrations): "Connect GitHub" → GitHub App install screen → user picks **All repositories** (future repos auto-included) or **Only select repositories**. On return, the installation is recorded.
2. **Link a repo to a project** (Project → Connect repository): pick a repo from the installation's current repos; a **"Don't see a repo? Manage access on GitHub →"** deep-link covers newly-created / not-yet-granted repos. Linking triggers a backfill of the repo's open issues.
3. **Issues lane**: the connected project's board shows an extra read-only **"GitHub Issues"** lane: open issues as cards (title, `#number`, labels, assignee, link out). Closing an issue removes its card. The lane is absent on unconnected projects.
4. **Task refs**: at project creation the user sets a **Task key** (2–5 letters, prefilled with a smart default from the name, editable, unique among their projects). Every task shows `KEY-NNN` (copyable).
5. **Commit completion**: a commit on the repo's default branch whose message contains `KEY-123` + a completion keyword (`done`, `(done)`, `completed`, `closes`, `closed`, `fixes`, `fixed`, `resolves`, `resolved`) moves task `KEY-123` to its project's Done column — regardless of which column it was in. Multiple refs in one message complete all of them.

## Architecture

- **GitHub App "LoomLance"** (registered once by the owner): permissions **Issues: read**, **Metadata: read**, **Contents: read** (for push events). Webhook subscribed to `installation`, `installation_repositories`, `issues`, `push`. The App **private key** and **webhook secret** live as Edge Function secrets. **No long-lived user tokens are stored** — the server mints short-lived *installation access tokens* on demand (App JWT → `POST /app/installations/{id}/access_tokens`).
- **`gitProvider` interface** (`supabase/functions/_shared/git-provider/`): `listOpenIssues(repo)`, `verifySignature(req)`, `parseEvent(payload)`, `parseSmartCommits(message)`. GitHub implementation now; GitLab later.
- **Edge functions:**
  - `github-webhook` (public, `verify_jwt=false`): verifies `X-Hub-Signature-256`; dispatches `installation` / `installation_repositories` / `issues` / `push`; idempotent via delivery id.
  - `github-repos` (authenticated): lists the caller's installation repos for the connect UI (mints an installation token).
  - `github-link-repo` (authenticated): links a repo to a project and backfills open issues.
  - Shared installation-token minter util.
- **Frontend:** an Integrations settings page; a "Connect repository" control + "Resync" in project settings; the read-only Issues lane in the kanban; `KEY-NNN` on task cards; a **Task key** field in the project-create modal.

## Data Model (new)

```
github_installations:   id uuid pk, user_id uuid (fk auth.users), installation_id bigint unique,
                        account_login text, account_type text, created_at, updated_at.  RLS: own.

project_repos:          id uuid pk, user_id uuid, project_id uuid unique (fk projects, 1:1),
                        installation_id bigint, repo_id bigint, repo_full_name text,
                        default_branch text not null default 'main', connected_at, disconnected_at.  RLS: own.

github_issue_cards:     id uuid pk, user_id uuid, project_id uuid (fk projects), repo_id bigint,
                        issue_number int, title text, state text, html_url text,
                        labels jsonb default '[]', assignee_login text, github_updated_at timestamptz,
                        synced_at timestamptz default now().  unique(project_id, issue_number).  RLS: own.

github_events:          delivery_id text pk, event_type text, received_at timestamptz default now().  (idempotency)
```

**Changes to existing tables:**
- `profiles`: add `commit_completion_scope text not null default 'project'` (CHECK in `('project','cross_project')`) — the per-user toggle controlling smart-commit resolution (see *Smart-Commit Parsing & Resolution*).
- `projects`: add `task_key text` (2–5 uppercase letters) with `unique(user_id, task_key)` — per-user-unique keys are required so Cross-project mode resolves unambiguously — and `last_task_number int not null default 0` (per-project counter).
- `tasks`: add `ref_number int` (per-project sequential). A `BEFORE INSERT` trigger assigns `ref_number` by atomically incrementing the project's `last_task_number`. Display ref = `task_key || '-' || lpad(ref_number::text, 3, '0')` (≥3 digits, grows naturally).
- **Backfill migration:** generate a `task_key` for every existing project (derive from name → uppercase alnum, 2–5 chars, de-duplicated per user), and assign `ref_number` to existing tasks per project ordered by `created_at`.

All new tables: RLS `user_id = auth.uid()` for select; writes happen via the webhook (service role) and authenticated RPCs/edge functions scoped to the caller.

## Sync & Webhooks

- **`issues`** (opened/edited/reopened/labeled/assigned): upsert into `github_issue_cards` for the linked project. On `closed`/`deleted`: delete the card row — the lane shows only **open** issues, so a closed issue's card disappears (this is how `Closes #N` commits make an issue card "complete").
- **`push`**: only commits to the repo's **default branch** are processed (mirrors GitHub's own `Closes #N` behavior; avoids feature-branch false-completions). For each commit, the parser extracts normalized `{key, number}` refs and the resolver maps them to tasks per the user's `commit_completion_scope` mode (see *Smart-Commit Parsing & Resolution*), moving each matched task to its project's **terminal (highest-position) kanban column** ("Done" by default). A ref with a keyword that resolves to no task emits a notification.
- **`installation`** (created/deleted): upsert/remove `github_installations` (and cascade-disconnect `project_repos` on delete).
- **`installation_repositories`** (added/removed): on `removed`, mark any `project_repos` referencing that repo as disconnected. (Available repos are read on demand, not cached, so additions need no handling beyond appearing in `github-repos`.)
- **Backfill**: on link, fetch current open issues via the provider and seed `github_issue_cards`.
- **Manual "Resync"**: re-runs backfill for the linked repo.
- **Idempotency**: each webhook delivery id is recorded in `github_events`; duplicate deliveries are skipped.

## Smart-Commit Parsing & Resolution (the high-risk unit — unit-tested)

Two stages: a pure **parser** (extract candidate refs) and a **resolver** (map refs to tasks per the user's mode).

**Parser** (`_shared/git-provider`, pure, unit-tested):
- A ref is `\b([A-Za-z]{2,5})[-\s#]0*(\d+)\b` — **case-insensitive**, leading zeros ignored, separator may be `-`, space, or `#`. So `LLM-1`, `llm-001`, `LLM 1`, `LLM#1` all normalize to the same `(KEY, number)`.
- A ref counts only if the message also contains a **completion keyword**: `{done, completed, complete, closes, close, closed, fixes, fix, fixed, resolves, resolve, resolved}` **plus a curated list of common misspellings** (`doen, donne, completd, compelted, clsoe, cloes, fixs, resloves, resoled`). Case-insensitive; parens/brackets optional (`(done)`, `[done]`). A **curated** misspelling list — not blind fuzzing — to avoid false positives like `dont → done`.
- Output: normalized `[{ key, number }]`. No ref or no keyword → empty.

**Resolver** (in the webhook; honors `profiles.commit_completion_scope`):
- **Project-scoped (default):** only the repo's **linked project** is in scope. Match the ref's key to that project's `task_key` with **fuzzy correction** (Levenshtein ≤1) — safe because exactly one valid key is in scope (`LMM-3`→`LLM-3`). Resolve the task by `number`; move it to the project's terminal column.
- **Cross-project:** the key resolves **globally** against the user's projects by **exact** `task_key` (keys are unique per user). **No fuzzy correction** — a typo must never silently complete a task in a different project. Complete each matched task.
- **Both modes:** parser normalization (case / separator / zero-padding) always applies. A ref carrying a keyword that resolves to **no** task (unknown/typo'd key in cross-project, or number not found) emits a `commit_unmatched_ref` notification ("Commit referenced `LLM-99` — no matching task") so the dev catches it. We never complete a task we aren't confident about.
- Default-branch commits only. Idempotent via webhook delivery id.
- Unit tests cover: normalization variants, keyword + misspellings, ref-only / keyword-only / both / multiple, `(done)`/`[done]`, and per-mode resolution (fuzzy hit in Project-scoped, exact-only + unmatched-notify in Cross-project).

## Security

- GitHub App, read-only scopes; **no stored long-lived user tokens** (short-lived installation tokens minted per call). Webhook signature (`X-Hub-Signature-256`) verified against the App webhook secret. RLS-own on every new table. Smart-commit completion only mutates tasks owned by the installation's LoomLance user. App private key + webhook secret stored only as Edge Function secrets, never in the client.

## Testing

- **Unit:** the smart-commit parser (all keyword/ref/edge cases); the `gitProvider` GitHub adapter mapping (issue payload → card shape); webhook signature verification.
- **Integration (hosted dev):** `issues` event upserts/removes a card; `push` event completes the referenced task into the Done column; backfill seeds open issues; idempotent on duplicate delivery.
- **Manual:** install App → link repo → see issues lane; create a task `KEY-001`; push `KEY-001 done` to default branch → task moves to Done; push `Closes #N` → issue card disappears.

## Resolved Design Decisions

- **Issues lane is connected-only and read-only**, and is **not** a gate — commit-completion works on any task in any column (decoupled from the lane).
- **Task keys are per-project, user-set** (2–5 letters, default-suggested, unique per user) → `KEY-NNN`. (Not per-user global, to avoid ever-growing numbers.)
- **Commit-completion scope is a per-user toggle** (`profiles.commit_completion_scope`): **Project-scoped** (default; safest + fuzzy key-typo correction) or **Cross-project** (one commit completes tasks across projects by exact key — for monorepo/multi-project-per-repo workflows). Format normalization + unmatched-ref notifications apply in both modes; fuzzy key correction is Project-scoped only.
- **One repo per project** in v1 (the repo↔project link drives the issues lane; commit-completion scope is governed by the toggle above, independent of the link).
- **GitHub App** auth (not OAuth/PAT) — scoped, no stored long-lived tokens, native webhooks, future-proof for two-way.
- **GitHub first**, GitLab behind the provider abstraction.
- **Default-branch commits only** trigger completion in v1.
