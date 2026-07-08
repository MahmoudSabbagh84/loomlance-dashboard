# Admin Phase 5 — In-App Announcements (Design)

**Status:** Approved 2026-07-08 · **Parent:** Admin roadmap in `2026-07-06-blog-admin-cms-design.md` (Phase 5) · **Follows:** Phase 4 Config & Banner (shipped 2026-07-08)

## Summary

Publishing a `release` blog post with a new **"Announce in-app"** toggle fans out one notification per user into the **existing notification bell** — no new UI surface, no Driver.js. Fan-out is a database trigger inside the publish transaction, once-only via an `announced_at` stamp.

## Decisions (brainstorming, 2026-07-08)

- **Context finding:** no Driver.js/tour infrastructure exists in the codebase (the tours convention is intent, not built). Owner chose the **What's-new-without-tours** shape; tours infra waits until an actual tour is needed.
- **Surface: the existing notification bell** (`user_notifications` + `NotificationBell`) over a separate What's-new panel. Accepted trade-offs: later signups don't see past announcements; unpublishing doesn't retract sent rows.
- **Trigger: opt-in checkbox per post** (release posts only), once-only via `announced_at` (re-publish and save-and-republish are no-ops). No un-announce / re-announce.
- **Mechanism: DB trigger** (`AFTER INSERT OR UPDATE` on `posts`, SECURITY DEFINER) over an edge function or cron — atomic with the publish, idempotent, no client involvement.
- Fan-out includes ALL users (demo + admins — notifications are part of the product demo).
- **No live announcements during implementation** — a real fan-out reaches 26 real users. All DB probes run inside `begin … rollback`.

## Data & fan-out

Migration:
- `posts` gains `announce_in_app boolean not null default false`, `announced_at timestamptz` (null = never fanned out).
- `announce_release_post()` — `SECURITY DEFINER`, `set search_path = public`, trigger `AFTER INSERT OR UPDATE` on `posts`. Fires when NEW row has `status = 'published' AND announce_in_app AND announced_at IS NULL AND category = 'release'`:
  1. Inserts into `user_notifications` for every `auth.users` row: `kind = 'announcement'`, `payload = jsonb {title, body: excerpt}`, `link_to = coalesce(external_url, 'https://loomlance.com/blog/' || slug)`.
  2. Updates the post's `announced_at = now()` (guard the trigger against recursion: the stamp-update must not re-fire the fan-out — condition already false because `announced_at` is set; use a plain `update ... where id = new.id`).
- Runs inside the publish transaction: fan-out failure fails the publish visibly (editor already surfaces publish errors). Comment notes revisiting batching at ~10k users.

## Editor

`AdminPostEditorPage` form gains `announce_in_app` (in `EMPTY`, hydration, and the save payload):
- Checkbox "Announce in-app" with helper text ("Notifies every user's bell when this release is published — once only"), visible only when `category === 'release'` and `announced_at` is not set.
- Switching category away from `release` clears `announce_in_app` (mirrors how switching away from `press` clears `external_url`).
- When `announced_at` is set: replace the checkbox with a static "Announced {formatDate(announced_at)}" note.

## Bell

`NotificationBell`: rows whose `link_to` starts with `http` render as `<a href={link_to} target="_blank" rel="noopener">` (same classes/handlers) instead of router `Link` — router `Link` mangles absolute URLs. Everything else (unread tint, mark-read on click, payload title/body, relative time) unchanged.

## Testing

- **Migration verification (hosted, rollback-probed):** inside `begin…rollback` — insert a ZZ-marked draft release post with `announce_in_app = true`, flip to published, count `user_notifications kind='announcement'` (= user count), fire the update again (no new rows — idempotent), verify `announced_at` stamped; roll back and confirm zero residue.
- **Component:** editor — toggle visible only for `release`; hidden and cleared after category switch; "Announced" note when `announced_at` set; save payload includes `announce_in_app`. Bell — external `link_to` renders an anchor with `target="_blank"`; internal `link_to` still a router link.
- **E2E:** none new (read-only rule; a live publish-with-announce would notify all real users).

## Out of scope

Driver.js/tours infra, retraction on unpublish, announcements for `update`/`press` posts, per-user notification preferences, back-filling announcements for later signups.
