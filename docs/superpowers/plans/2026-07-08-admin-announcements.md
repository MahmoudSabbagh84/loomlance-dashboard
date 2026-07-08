# Admin Phase 5 — In-App Announcements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An "Announce in-app" toggle on release posts that, on first publish, fans one notification per user into the existing bell — once only.

**Architecture:** DB trigger (`SECURITY DEFINER`) inside the publish transaction inserts `user_notifications` rows for all users and stamps `posts.announced_at`; the post editor gains the toggle (release-only, locks after fan-out); `NotificationBell` learns to render external `link_to` as a real anchor.

**Tech Stack:** Postgres (hosted `zbipqfsqxnvrzhpdjvvy`), React 18 + TanStack Query v5, vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-admin-announcements-design.md` · **Linear:** "Admin Phase 5 — In-App Announcements"

## Global Constraints

- Repo: `C:\Users\mahmo\Desktop\LoomLance-Dashboard`. Commit after every task. Do NOT `git push`.
- Migration via `mcp__supabase__apply_migration`; committed filename must equal the recorded version.
- LIVE PRODUCTION DB with 26 real users: **never fan out for real** — every trigger probe runs inside `begin … rollback`, using a ZZ-marked throwaway post created and destroyed inside that same transaction. No e2e for the announce path.
- Public blog base URL: `https://loomlance.com`.
- UI kit imports from `@/components/ui/*`; Impeccable pass on UI tasks; tests `npx vitest run` (baseline 239 green).

---

### Task 1: Migration — announce columns + fan-out trigger

**Files:**
- Create: `supabase/migrations/<applied-version>_announce_release_posts.sql`

**Interfaces:**
- Produces: `posts.announce_in_app boolean not null default false`, `posts.announced_at timestamptz`, trigger `posts_announce` calling `announce_release_post()`. Fan-out contract consumed by the bell: `user_notifications` rows `kind='announcement'`, `payload {title, body}`, `link_to` = external_url or `https://loomlance.com/blog/<slug>`.

- [ ] **Step 1: Write the migration**

```sql
-- Phase 5: in-app announcements. Publishing a release post with announce_in_app fans out one
-- notification per user into the existing bell (user_notifications), exactly once — the
-- announced_at stamp makes re-publishes no-ops. SECURITY DEFINER so the fan-out insert isn't
-- blocked by user_notifications RLS. Runs inside the publish transaction: if fan-out fails,
-- the publish fails visibly. Per-user insert is trivial at current scale; revisit batching
-- around ~10k users.
alter table public.posts
  add column announce_in_app boolean not null default false,
  add column announced_at timestamptz;

create or replace function public.announce_release_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
     and new.announce_in_app
     and new.announced_at is null
     and new.category = 'release' then
    insert into public.user_notifications (user_id, kind, payload, link_to)
    select
      u.id,
      'announcement',
      jsonb_build_object('title', new.title, 'body', new.excerpt),
      coalesce(new.external_url, 'https://loomlance.com/blog/' || new.slug)
    from auth.users u;

    -- Stamp AFTER the fan-out; this UPDATE re-fires the trigger but the announced_at
    -- condition is then false, so it cannot recurse into a second fan-out.
    update public.posts set announced_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

create trigger posts_announce
  after insert or update on public.posts
  for each row execute function public.announce_release_post();
```

- [ ] **Step 2: Apply via `mcp__supabase__apply_migration`** (name `announce_release_posts`); fetch the recorded version; save the file with the matching name.

- [ ] **Step 3: Verify with a rollback probe** via `mcp__supabase__execute_sql` — ALL inside one transaction:

```sql
begin;
-- throwaway announce-flagged release post (ZZ marker), author = admin
insert into public.posts (author_id, title, slug, category, excerpt, body_md, status, announce_in_app)
select id, 'ZZ probe', 'zz-probe-announce', 'release', 'probe excerpt', 'x', 'draft', true
from auth.users where email = 'admin@loomlance.com';

update public.posts set status = 'published', published_at = now() where slug = 'zz-probe-announce';

select count(*) as fanout_rows,
       (select count(*) from auth.users) as user_count,
       (select announced_at is not null from public.posts where slug = 'zz-probe-announce') as stamped
from public.user_notifications where kind = 'announcement';

-- idempotency: touch the published post again — no new rows
update public.posts set title = 'ZZ probe 2' where slug = 'zz-probe-announce';
select count(*) as fanout_rows_after_retouch from public.user_notifications where kind = 'announcement';

rollback;
select count(*) as residue from public.user_notifications where kind = 'announcement';  -- expect 0
```

Expected: `fanout_rows = user_count` (≈26), `stamped = true`, `fanout_rows_after_retouch` unchanged, `residue = 0`. Check the actual `posts` NOT NULL columns first (`author_id` name, etc.) and adapt the probe insert — the probe must satisfy the real schema. If the posts INSERT trigger path fires on the draft insert (it must not — status is 'draft'), that's a finding to fix, not adapt around.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_announce_release_posts.sql
git commit -m "feat(db): announce-release-post fan-out trigger, once-only via announced_at"
```

---

### Task 2: Editor — "Announce in-app" toggle (TDD + Impeccable)

**Files:**
- Modify: `src/pages/admin/AdminPostEditorPage.jsx`
- Test: `src/pages/admin/__tests__/AdminPostEditorPage.test.jsx` (new)

**Interfaces:**
- Consumes: existing form state (`EMPTY` at ~line 25, `set()` field helper ~line 64 with the category-switch clearing pattern, `payload()` builder ~line 85, category `Select` ~line 235, press-only block ~line 243), hooks from `@/hooks/usePosts`, upload API `@/api/blogImages`.
- Produces: `announce_in_app` flows through create/update payloads; UI rules per spec.

- [ ] **Step 1: Write the failing tests** — mock `@/hooks/usePosts` (all five exports used by the editor: `usePost`, `useCreatePost`, `useUpdatePost`, `useSetPostStatus`, and any others the file imports — check its import line and mock exactly those) and `@/api/blogImages`. Mount via `MemoryRouter` route `/admin/posts/:id` with a mocked existing post.

```jsx
// Cases (write them fully, mirroring AdminUserDetailPage.test.jsx conventions):
// 1. release draft, not announced → checkbox labeled "Announce in-app" is visible + unchecked
// 2. update-category draft → checkbox absent
// 3. release post with announced_at set → checkbox absent, text /Announced/ visible
// 4. check the box + Save draft → update mutation called with announce_in_app: true in the patch
// 5. switch category release → update with the box checked → next save patch has announce_in_app: false
```

- [ ] **Step 2: Run** — `npx vitest run src/pages/admin/__tests__/AdminPostEditorPage.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Implement**

- `EMPTY` gains `announce_in_app: false`.
- Hydration (`setForm({ ...existing, ... })`) already carries the column once selected — confirm `src/api/posts.js` selects `*` (it does for detail; verify) so `announce_in_app`/`announced_at` arrive.
- `set()` category-switch rule: alongside the existing `if (field === 'category' && value !== 'press') next.external_url = ''` add `if (field === 'category' && value !== 'release') next.announce_in_app = false`.
- `payload()` gains `announce_in_app: form.announce_in_app`.
- UI, placed with the other category-conditional block (mirror the press block's structure):

```jsx
{form.category === 'release' && !existingAnnouncedAt && (
  <label className="flex items-start gap-2.5 text-sm">
    <input
      type="checkbox"
      checked={form.announce_in_app}
      onChange={(e) => set('announce_in_app', e.target.checked)}
      className="mt-0.5 size-4 accent-primary"
    />
    <span>
      Announce in-app
      <span className="block text-xs text-fg-muted">
        Notifies every user's bell when this release is published — once only.
      </span>
    </span>
  </label>
)}
{form.category === 'release' && existingAnnouncedAt && (
  <p className="text-sm text-fg-muted">Announced {formatDate(existingAnnouncedAt)}</p>
)}
```
where `existingAnnouncedAt` comes from the loaded post row (`existing?.announced_at` — thread it from the `usePost` data the same way `hydratedId` handling works; check the file). Import `formatDate` from `@/lib/date`. If the kit has a `Checkbox` component (`ls src/components/ui`), use it instead of the raw input.

- [ ] **Step 4: Run tests until green**, then the full suite `npx vitest run`. Run the **Impeccable pass** on the editor block.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminPostEditorPage.jsx src/pages/admin/__tests__/AdminPostEditorPage.test.jsx
git commit -m "feat(admin): announce-in-app toggle on release posts"
```

---

### Task 3: Bell — external links (TDD)

**Files:**
- Modify: `src/components/layout/NotificationBell.jsx`
- Test: `src/components/layout/__tests__/NotificationBell.test.jsx` (new)

- [ ] **Step 1: Failing tests** — mock `@/hooks/useNotifications` (all four exports the bell imports: `useNotifications`, `useUnreadCount`, `useMarkAllRead`, `useMarkRead`).

```jsx
// Cases:
// 1. note with link_to 'https://loomlance.com/blog/x' → open the bell → the row is an <a> with
//    href equal to the URL, target="_blank", rel containing "noopener"
// 2. note with link_to '/invoices/123' → row is a router link with href '/invoices/123'
// 3. clicking the external row still calls markRead with the note id
// (Render inside MemoryRouter; open the popover by clicking the "Notifications" button.)
```

- [ ] **Step 2: Run** — Expected: FAIL (all rows are router Links today).

- [ ] **Step 3: Implement** — in the notes `.map()`, branch on `const external = n.link_to?.startsWith('http')`:

```jsx
{external ? (
  <a
    href={n.link_to}
    target="_blank"
    rel="noopener noreferrer"
    onClick={() => { if (!n.read_at) markRead.mutate(n.id); setOpen(false) }}
    className="block p-3 text-sm hover:bg-bg-muted"
  >
    {rowContent}
  </a>
) : (
  <Link to={n.link_to || '#'} onClick={...same...} className="block p-3 text-sm hover:bg-bg-muted">
    {rowContent}
  </Link>
)}
```
Extract the row body (title/body/relativeTime block) into a small local `rowContent` JSX variable or inline component so the two branches don't duplicate it.

- [ ] **Step 4: Run tests until green**, then full suite.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/NotificationBell.jsx src/components/layout/__tests__/NotificationBell.test.jsx
git commit -m "feat(notifications): render external link_to as real anchors (announcement links)"
```

---

### Task 4: Full verification

- [ ] **Step 1:** `npx vitest run` all green; `npx vite build` succeeds.
- [ ] **Step 2:** `npx playwright test` with the usual admin env creds — all 4 specs green (announce path deliberately untested e2e).
- [ ] **Step 3:** No commit needed unless fixes were made.

---

## Self-review notes

- **Spec coverage:** columns + trigger + once-only + rollback-probe (T1), editor toggle rules incl. category-switch clearing and announced-note (T2), bell external anchors with mark-read preserved (T3), verification (T4). No live fan-out anywhere.
- **Type consistency:** trigger writes `kind='announcement'`, `payload {title, body}`, `link_to` — exactly what `NotificationBell` renders (`payload?.title`, `payload?.body`, `link_to`); editor field name `announce_in_app` matches column and payload key.
- **Known unknowns:** posts table's exact NOT NULL columns for the probe insert (T1 Step 3 resolves), the editor's `existing`/`hydratedId` variable names (T2 Step 3 resolves against the file), whether a kit `Checkbox` exists (T2 Step 3), the editor's usePosts import list for mocking (T2 Step 1).
