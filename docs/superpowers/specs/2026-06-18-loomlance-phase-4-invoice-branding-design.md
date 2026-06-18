# LoomLance Phase 4 — Invoice Branding Design

**Status:** Approved 2026-06-18
**Phase 4 sub-project 1 of 5** (branding → time tracking → expenses → recurring → reports). Each sub-project gets its own spec → plan → build cycle.

## 1. Goal

Give Tier 1+ freelancers a **Profile → Branding** tab to set the three branding fields their invoices already honor — **logo, accent color, footer** — including uploading a logo. This completes a half-built feature: the invoice editor preview, the downloadable PDF, and the public invoice page already render `logo_url` / `invoice_accent_color` / `invoice_footer` for paid tiers; there is simply no UI to set them today.

## 2. Scope

### In scope
- A new **Branding** tab on the existing tabbed Profile page, gated to Tier 1+ (`CUSTOM_BRANDING`).
- **Logo upload** (optional) to a public Supabase Storage bucket; stored as `profile.logo_url`.
- **Accent color** picker and **footer** text editor, persisted to the existing profile columns.
- A **compact live preview** of the invoice header reflecting the current logo/accent/footer.
- Tier gating: free users see an upgrade prompt instead of the editor.

### Already done (not in scope — reused as-is)
- `profiles.logo_url`, `profiles.invoice_accent_color` (default `#2D3E50`), `profiles.invoice_footer` columns.
- Invoice rendering honors them for `subscription_tier !== 'free'` in `InvoicePreview`, `InvoicePDF` (`buildInvoiceBlob`), and `PublicInvoiceView`.
- `FEATURES.CUSTOM_BRANDING` in `lib/tier.js` (true for tier_1 + tier_2) and the `TierGate`/`UpgradeCard`/`UpgradeDialog` gate components.

### Out of scope
- New profile columns (none needed).
- Changing how invoices render branding (already correct).
- Per-invoice branding overrides (branding is per-business/profile).

## 3. Storage

Logos appear on the **anonymous public invoice page** and inside emailed PDFs, so they need a **stable, public URL** (signed URLs expire — wrong for long-lived links). Logos are not sensitive (they are meant to be shown to clients).

**New public bucket `branding-logos`** (migration), RLS mirroring the existing `contract-pdfs` pattern but with **public read**:
- `select`: public (anyone) — needed for the public invoice page + emailed PDFs.
- `insert` / `update` / `delete`: authenticated, only within the caller's own folder — `storage.foldername(name)[1] = auth.uid()::text`.

**Path convention:** `<userId>/logo-<timestamp>.<ext>`. Upload writes a new object and overwrites `profile.logo_url`; the previous file is deleted on replace/remove (best-effort).

**Constraints (client-enforced):** types `image/svg+xml`, `image/png`, `image/jpeg`, `image/webp`; max size **2 MB**. One logo per user.

## 4. Components

### 4.1 `src/api/branding.js`
- `uploadLogo(file)` → uploads to `branding-logos/<userId>/logo-<ts>.<ext>` (`upsert: true`), returns the bucket's **public URL** (`supabase.storage.from('branding-logos').getPublicUrl(path)`). Validates type/size, throwing a friendly `AppError` on violation.
- `removeLogo(logoUrl)` → derives the storage path from the public URL and deletes the object (best-effort; ignores "not found").

The `logo_url` / `invoice_accent_color` / `invoice_footer` values themselves are persisted through the existing `useUpdateProfile` mutation — `branding.js` only handles the file side.

### 4.2 `src/features/profile/BrandingTab.jsx`
- Reads `useProfile`; `tier = subscription_tier`. If **not** `hasFeature(tier, CUSTOM_BRANDING)`, render an `UpgradeCard` (feature `CUSTOM_BRANDING`, target `tier_1`) and nothing else.
- For Tier 1+:
  - **Logo block** — current logo thumbnail (or an "empty" placeholder when none), an **Upload** control (`<input type=file accept="image/svg+xml,image/png,image/jpeg,image/webp">`), and a **Remove** button when a logo exists. Upload → `uploadLogo` → `useUpdateProfile({ logo_url })`. Remove → `removeLogo` + `useUpdateProfile({ logo_url: null })`.
  - **Accent color** — `<input type=color>` bound to a hex text field (two-way), plus a **Reset to default** (`#2D3E50`) action. Form via react-hook-form.
  - **Footer** — `<Textarea>`.
  - **Save** — persists accent + footer via `useUpdateProfile` (logo saves immediately on upload/remove). Toast on success/error.
  - **Live preview** — a compact invoice-header sample: the logo if present, else the **business name in the accent color**, plus the footer line. Re-renders as the user edits (react-hook-form `watch` + the current logo_url).
- Copy notes the logo is **optional** — branding (accent + footer) applies with or without it.

### 4.3 `src/pages/ProfilePage.jsx`
- Add `{ key: 'branding', label: 'Branding' }` to `TABS` between `business` and `payments`; render `{tab === 'branding' && <BrandingTab />}`.

## 5. Tier consistency

`hasFeature(tier, CUSTOM_BRANDING)` is true for `tier_1`/`tier_2` — exactly the set where invoices render `branded = subscription_tier !== 'free'`. So a user who can *set* branding is precisely the set whose invoices *show* it. Free users are blocked at the tab (UpgradeCard) and, defensively, their branding is ignored at render time regardless of stored values.

## 6. No-logo handling

The logo is optional throughout: `uploadLogo` is never required; `logo_url` may be null. Every render path already falls back to the **business name styled in the accent color** when `logo_url` is absent (`InvoicePreview`, `PublicInvoiceView`, `InvoicePDF`). The Branding tab's preview mirrors this fallback so the no-logo experience is visible and intentional.

## 7. Error handling

- File too large / wrong type → `AppError` with a friendly message ("Logos must be an image under 2 MB."), surfaced as a toast; no upload attempted.
- Storage/network errors → `mapPostgresError`/generic toast.
- Reuses existing error plumbing; no new error codes required (a client-side validation message suffices).

## 8. Testing & verification

- **Live Playwright (tier-2 test user):**
  1. Profile → Branding renders the editor (not an upgrade card).
  2. Set accent color (e.g. `#7C5CFF`) + footer text → Save → toast; reload → values persist.
  3. Upload a small PNG logo → thumbnail appears + `logo_url` set; open a sent invoice's public page → the **logo**, **accent color**, and **footer** render.
  4. **Remove** logo → public page falls back to the **business name in the accent color**; footer still shows.
  5. Oversized/invalid file → validation toast, no upload.
- **Unit:** the logo file-validation helper (type/size) and the public-URL→path derivation in `branding.js`.
- Clean up any uploaded test logo from the bucket afterward; the test user is in active use — touch only its own branding.

## 9. Decisions made during brainstorming

- **Public `branding-logos` bucket** (not private/signed) — logos are non-sensitive and must load on the anonymous public invoice page + emailed PDFs.
- **Logo is optional / SVG kept** — support SVG/PNG/JPG/WebP for upload freedom; no-logo is a first-class state (business-name fallback).
- **Compact header preview** (not a full invoice preview) in the tab.
- **No new columns** — reuse the three existing profile fields; one storage-bucket migration only.
