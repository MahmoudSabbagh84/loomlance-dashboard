# Blog + Admin CMS — Design

**Date:** 2026-07-06
**Status:** Approved (brainstormed with owner)
**Scope:** v1 = public blog on the splash site + owner-only `/admin` area in the Dashboard app with two panels (Posts CMS, Demo reset) + publish pipeline. Phases 2–6 are backlog, each getting its own spec→plan later.

## Goal

A public blog/press surface where LoomLance posts feature releases, product updates, and press mentions — each post with its own URL, full SEO/OG treatment, and RSS. Posts are authored and published from a new admin dashboard inside the existing Dashboard app. The admin shell is built to grow into a full internal ops panel (metrics, user support, config, announcements, ops visibility).

## Decisions made during brainstorming

1. **Full blog with per-post pages** (not a single changelog feed, not press-only). SEO + shareability + resale value.
2. **Admin lives inside the Dashboard app** at `/admin`, gated by an `is_admin` profile flag with RLS enforcement (not a separate app, not in the splash repo).
3. **Publish = rebuild static HTML, live in ~1–3 min** (Approach A): DB is the source of truth; publishing triggers a GitHub Action in the splash repo that regenerates static pages. Chosen over Edge-Function-renders-everything (B) and manual local script (C).
4. **Demo reset joins v1** alongside the CMS.

## Architecture

```
Dashboard app (/admin, React)          Supabase                     Splash repo (static)
┌─────────────────────────┐   CRUD   ┌──────────────┐   dispatch   ┌──────────────────────┐
│ Posts CMS  ────────────────────────▶ posts table  │              │ .github/workflows/    │
│  Publish button ─────────▶ Edge Fn: trigger-blog-publish ───────▶│   blog.yml            │
│ Demo reset ──────────────▶ SQL fn: reset_demo_user()             │  └ scripts/build-blog │
└─────────────────────────┘          │ blog-images  │◀── fetch ────│     .mjs (Node)       │
                                     │ storage      │  published   │  → /blog/*.html, RSS  │
                                     └──────────────┘  (anon key)  │  → commit → autodeploy│
                                                                   └──────────────────────┘
```

## Data model (Dashboard repo migration)

`posts` table:

- `id uuid pk default gen_random_uuid()`
- `slug text unique not null` — auto-generated from title in the UI, editable until first publish, locked after (URLs never break)
- `title text not null`
- `excerpt text not null` — doubles as meta description + share-card text; UI shows ~155-char counter
- `body_md text not null default ''`
- `cover_image_url text` — nullable
- `category text not null check in ('release','update','press')`
- `external_url text` — nullable; when set (press link-outs), the blog index links directly to the outlet and no internal post page is generated
- `status text not null default 'draft' check in ('draft','published')`
- `published_at timestamptz` — set on first publish
- `created_at` / `updated_at timestamptz`

**`profiles.is_admin boolean not null default false`** + SQL helper `is_admin()` for policies.

**RLS:**
- `posts`: anon/authenticated SELECT where `status = 'published'`; admin full CRUD.
- Storage bucket `blog-images` (public read): INSERT/UPDATE/DELETE admin-only.

**`reset_demo_user()`** — `security definer` SQL function, hard-coded to the demo user id (`d3a70000-…`); deletes the demo user's rows and re-seeds the canonical screencast fixture. Callable by admins only. Physically cannot touch any other user's data.

## Public blog (splash repo, generated)

- `/blog` — index in the splash's existing visual language (same header/footer/tokens, Bricolage display headings). Rows: category chip, date, title, excerpt, optional cover thumbnail. Press posts with `external_url` render as link-outs with the ↗ affordance.
- `/blog/<slug>` — post page: cover, title, date, category, markdown rendered with `@tailwindcss/typography` prose styles (plugin added to splash Tailwind config); full `<title>`/meta description/OG/canonical tags; "← All posts".
- `/blog/feed.xml` — RSS. Sitemap gains blog URLs.
- "Blog" link added to nav + footer of existing splash pages.
- Markdown sanitized at generation time; static output = no runtime XSS surface.

## Admin area (Dashboard app)

Route `/admin` with its own sidebar, reusing existing components/tokens. Client-side guard on `is_admin` (nav hidden, direct URL redirects); real security is the RLS layer.

**Posts panel:** list view (title, category, status, published date) + editor (title, slug, category, excerpt with counter, cover upload, markdown body with side-by-side live preview, autosave to draft). Actions: Save draft / Publish / Unpublish; editing a published post re-triggers the pipeline on save-and-republish.

**Demo reset panel:** one card + confirm dialog → calls `reset_demo_user()` → toast with result.

## Publish pipeline

1. Publish → Edge Function `trigger-blog-publish` (verifies caller JWT + `is_admin`) → GitHub `repository_dispatch` (`event_type: blog_publish`) on the splash repo, using a fine-grained GitHub token stored as a function secret.
2. Splash repo workflow `.github/workflows/blog.yml`: checkout → `npm ci` → `node scripts/build-blog.mjs` (fetches published posts via Supabase **anon** key — RLS exposes only published) → rebuild Tailwind CSS → commit + push → host auto-deploys.
3. Generator runs locally too (`node scripts/build-blog.mjs`) for preview/debugging.
4. Admin UX after publish: "Publish triggered — live in ~2 minutes" + link to the Actions run.

**Failure behavior:** dispatch failure surfaces in admin; post stays `published` in DB (source of truth) and Publish can be re-hit. Failed Actions notify via GitHub email. The generator always regenerates the entire blog from the DB — every run is idempotent and self-healing; no partial states.

## Testing

- Unit tests for the generator (slug/URL building, markdown rendering + sanitization, RSS validity, external_url link-out behavior) — plain Node, lives in splash repo.
- RLS tests for `is_admin` policies (existing suite's pattern, Dashboard repo).
- Playwright: admin CRUD flow (create draft → edit → publish mock → unpublish).

## Non-goals (v1)

Comments, newsletter signup, scheduled publishing, multi-author, tags beyond the three categories, WYSIWYG editing, in-admin pipeline status polling.

## Admin roadmap (backlog — each phase gets its own spec→plan)

- **Phase 2 — Business pulse:** signups/week, active users, tier breakdown, trial conversions, MRR (Stripe).
- **Phase 3 — User lookup & support:** search by email; view tier/subscription/invoice/project counts/last login; comp a tier; deactivate.
- **Phase 4 — Config & kill switches:** UI over existing `app_config` (maintenance banner, signup toggle, feature flags).
- **Phase 5 — Announcements:** publishing a `release` post can optionally create an in-app "What's new" Driver.js announcement (per the existing tours convention).
- **Phase 6 — Ops visibility:** email send failures, Stripe webhook errors, cron job status.

## New credentials / owner setup

- Fine-grained GitHub token (splash repo, contents:write + metadata) → Supabase Edge Function secret.
- Supabase URL + anon key → splash repo Actions secrets.
- Set `is_admin = true` on the owner's profile row (one-time SQL).
