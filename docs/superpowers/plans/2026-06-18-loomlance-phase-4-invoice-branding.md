# Phase 4 — Invoice Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Profile → Branding tab (Tier 1+) to upload a logo and set the invoice accent color + footer that the invoice/PDF/public page already render.

**Architecture:** A public Storage bucket holds logos (public read; own-folder write). A small `api/branding.js` handles file validation + upload/remove; the three values persist through the existing `useUpdateProfile`. `BrandingTab.jsx` is gated by `hasFeature(tier, CUSTOM_BRANDING)` and wired into the existing tabbed Profile page.

**Tech Stack:** Supabase Storage, supabase-js, react-hook-form, the existing `useProfile`/`useUpdateProfile`, `TierGate`/`UpgradeCard`, Vitest, Playwright.

**Conventions:** Apply the migration via MCP `apply_migration` → `list_migrations` → write `supabase/migrations/<version>_<name>.sql` to match → commit. Lint is a hard gate (`npx eslint . --max-warnings 0` must exit 0). Test user `test@loomlance.com` / `password123` is tier_2 and in active use — clean up only its own branding/test logo. Spec: `docs/superpowers/specs/2026-06-18-loomlance-phase-4-invoice-branding-design.md`.

---

### Task 1: Storage bucket for logos

**Files:**
- Create: `supabase/migrations/<version>_branding_logos_bucket.sql` (mirror of the MCP migration)

- [ ] **Step 1: Apply via MCP `apply_migration` (name: `branding_logos_bucket`)**

```sql
-- Public bucket: logos must load on the anonymous public invoice page + emailed PDFs.
insert into storage.buckets (id, name, public) values ('branding-logos', 'branding-logos', true)
on conflict (id) do nothing;

-- Public read is automatic for a public bucket. Writes are scoped to the caller's own folder.
create policy "branding_logos_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'branding-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "branding_logos_update_own"
  on storage.objects for update
  using (bucket_id = 'branding-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "branding_logos_delete_own"
  on storage.objects for delete
  using (bucket_id = 'branding-logos' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 2: Verify via MCP `execute_sql`**

```sql
select id, public from storage.buckets where id = 'branding-logos';
-- expect: public = true
```

- [ ] **Step 3: Mirror locally.** MCP `list_migrations` → take the new version → Write the identical SQL to `supabase/migrations/<version>_branding_logos_bucket.sql`.

- [ ] **Step 4: Commit.**

```bash
git add supabase/migrations/<version>_branding_logos_bucket.sql docs/superpowers/plans/2026-06-18-loomlance-phase-4-invoice-branding.md docs/superpowers/specs/2026-06-18-loomlance-phase-4-invoice-branding-design.md
git commit -m "feat(branding): public storage bucket for invoice logos"
```

---

### Task 2: Branding API + unit tests

**Files:**
- Create: `src/api/branding.js`
- Create: `src/api/__tests__/branding.test.js`

- [ ] **Step 1: Write the failing test** — `src/api/__tests__/branding.test.js`

```js
import { describe, it, expect } from 'vitest'
import { validateLogoFile, logoPathFromUrl, LOGO_MAX_BYTES } from '@/api/branding'

describe('validateLogoFile', () => {
  it('accepts a small png', () => {
    expect(() => validateLogoFile({ type: 'image/png', size: 1000 })).not.toThrow()
  })
  it('accepts svg', () => {
    expect(() => validateLogoFile({ type: 'image/svg+xml', size: 1000 })).not.toThrow()
  })
  it('rejects a non-image', () => {
    expect(() => validateLogoFile({ type: 'application/pdf', size: 1000 })).toThrow(/image/i)
  })
  it('rejects an oversize file', () => {
    expect(() => validateLogoFile({ type: 'image/png', size: LOGO_MAX_BYTES + 1 })).toThrow(/2 ?MB/i)
  })
})

describe('logoPathFromUrl', () => {
  it('extracts the storage path from a public url', () => {
    const url = 'https://ref.supabase.co/storage/v1/object/public/branding-logos/abc-123/logo-9.png'
    expect(logoPathFromUrl(url)).toBe('abc-123/logo-9.png')
  })
  it('returns null for an unrelated url', () => {
    expect(logoPathFromUrl('https://example.com/x.png')).toBe(null)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/api/__tests__/branding.test.js`
Expected: FAIL (module `@/api/branding` not found).

- [ ] **Step 3: Implement `src/api/branding.js`**

```js
import { supabase } from '@/lib/supabase'
import { AppError, mapPostgresError } from '@/lib/errors'

export const LOGO_MAX_BYTES = 2 * 1024 * 1024 // 2 MB
export const LOGO_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
const BUCKET = 'branding-logos'

export function validateLogoFile(file) {
  if (!file || !LOGO_TYPES.includes(file.type)) {
    throw new AppError('UNKNOWN', 'Logo must be an SVG, PNG, JPG, or WebP image.')
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new AppError('UNKNOWN', 'Logo must be under 2 MB.')
  }
}

export function logoPathFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  const marker = `/${BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length)
}

const EXT = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export async function uploadLogo(file) {
  validateLogoFile(file)
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new AppError('UNAUTHORIZED', 'You must be signed in.')
  const path = `${userId}/logo-${Date.now()}.${EXT[file.type]}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw mapPostgresError(error)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function removeLogo(logoUrl) {
  const path = logoPathFromUrl(logoUrl)
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error && error.message && !/not found/i.test(error.message)) throw mapPostgresError(error)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/api/__tests__/branding.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit.** Gate `npx eslint . --max-warnings 0`. `git add src/api/branding.js src/api/__tests__/branding.test.js && git commit -m "feat(branding): logo upload/remove api + validation tests"`.

---

### Task 3: Branding tab UI + Profile wiring

**Files:**
- Create: `src/features/profile/BrandingTab.jsx`
- Modify: `src/pages/ProfilePage.jsx`

- [ ] **Step 1: `BrandingTab.jsx`**

```jsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { hasFeature, FEATURES } from '@/lib/tier'
import { uploadLogo, removeLogo, LOGO_TYPES } from '@/api/branding'

const DEFAULT_ACCENT = '#2D3E50'

export function BrandingTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [uploading, setUploading] = useState(false)

  const { register, handleSubmit, watch, setValue } = useForm({
    values: {
      invoice_accent_color: profile?.invoice_accent_color || DEFAULT_ACCENT,
      invoice_footer: profile?.invoice_footer || '',
    },
  })

  if (!hasFeature(tier, FEATURES.CUSTOM_BRANDING)) {
    return <UpgradeCard feature={FEATURES.CUSTOM_BRANDING} currentTier={tier} target="tier_1" />
  }

  const accent = watch('invoice_accent_color')
  const footer = watch('invoice_footer')

  const onLogoChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadLogo(file)
      await update.mutateAsync({ logo_url: url })
      toast.success('Logo updated')
    } catch (err) {
      toast.error(err.userMessage || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onRemoveLogo = async () => {
    try {
      await removeLogo(profile.logo_url)
      await update.mutateAsync({ logo_url: null })
      toast.success('Logo removed')
    } catch (err) {
      toast.error(err.userMessage || 'Could not remove logo')
    }
  }

  const onSave = async (values) => {
    try {
      await update.mutateAsync(values)
      toast.success('Branding saved')
    } catch (err) {
      toast.error(err.userMessage || 'Could not save branding')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={handleSubmit(onSave)} className="space-y-5">
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold">Logo <span className="font-normal text-fg-muted">(optional)</span></h3>
          <div className="flex items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-bg-muted">
              {profile?.logo_url ? <img src={profile.logo_url} alt="" className="max-h-full max-w-full" /> : <span className="text-xs text-fg-subtle">None</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md bg-bg-muted px-3.5 text-sm font-medium text-fg transition-colors hover:bg-bg-elevated">
                {uploading ? 'Uploading…' : 'Upload logo'}
                <input type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={onLogoChange} disabled={uploading} />
              </label>
              {profile?.logo_url ? <Button type="button" variant="ghost" onClick={onRemoveLogo}>Remove</Button> : null}
            </div>
          </div>
          <p className="text-xs text-fg-muted">SVG, PNG, JPG, or WebP · up to 2 MB. No logo? Invoices show your business name instead.</p>
        </Card>

        <Card className="space-y-4">
          <div>
            <Label htmlFor="accent">Accent color</Label>
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Accent color" className="h-9 w-12 cursor-pointer rounded-md border border-border bg-bg-muted" {...register('invoice_accent_color')} />
              <Input className="w-32" {...register('invoice_accent_color')} />
              <Button type="button" variant="ghost" size="sm" onClick={() => setValue('invoice_accent_color', DEFAULT_ACCENT)}>Reset</Button>
            </div>
          </div>
          <div>
            <Label htmlFor="invoice_footer">Invoice footer</Label>
            <Textarea id="invoice_footer" rows={3} placeholder="e.g. Thank you for your business · Payment due within 30 days" {...register('invoice_footer')} />
          </div>
          <Button type="submit" loading={update.isPending}>Save branding</Button>
        </Card>
      </form>

      <div className="lg:sticky lg:top-20 lg:h-fit">
        <p className="mb-2 text-xs uppercase tracking-wide text-fg-muted">Preview</p>
        <div className="rounded-lg border border-border bg-white p-6 text-black">
          <div className="flex items-start justify-between">
            <div>
              {profile?.logo_url
                ? <img src={profile.logo_url} alt="" className="mb-2 h-12" />
                : <h2 className="text-xl font-bold" style={{ color: accent }}>{profile?.business_name || 'Your Business'}</h2>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: accent }}>INVOICE</h1>
          </div>
          <div className="mt-6 border-t border-gray-200 pt-3 text-xs text-gray-500">Line items · totals · etc.</div>
          {footer ? <p className="mt-8 whitespace-pre-line text-center text-xs text-gray-600">{footer}</p> : null}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `ProfilePage.jsx`** — import `BrandingTab`; add `{ key: 'branding', label: 'Branding' }` to `TABS` after `business`; render `{tab === 'branding' && <BrandingTab />}`.

- [ ] **Step 3: Gate + commit.** `npm run build`, `npx eslint . --max-warnings 0`, `npx vitest run`. `git add src/features/profile/BrandingTab.jsx src/pages/ProfilePage.jsx && git commit -m "feat(branding): profile branding tab (logo, accent, footer)"`.

---

### Task 4: Live verification + wrap

- [ ] **Step 1: Build + preview.** `npm run build`; `npm run preview` (note the port). (react-pdf isn't exercised here; dev or preview both fine.)
- [ ] **Step 2: Playwright (tier-2 test user):**
  1. Login → `/profile?tab=branding` → the editor renders (not an UpgradeCard).
  2. Fill accent `#7C5CFF`, footer `ZZ Test footer` → Save → toast; reload → values persisted; the **Preview** shows "INVOICE" in violet + the footer.
  3. Upload a tiny PNG (write a few-byte valid PNG to a temp path) → thumbnail appears; `profile.logo_url` set; the Preview shows the logo instead of the business name.
  4. **Remove** → preview reverts to the business name in the accent color.
  5. Reset the test user's branding to clean values afterward (accent back to `#2D3E50`, footer null, logo_url null) and delete the uploaded object from the bucket.
  Expected: all pass, 0 page errors.
- [ ] **Step 3:** Update memory — add an invoice-branding entry to `loomlance_phase3_progress.md`/a new Phase 4 note (sub-project 1 of 5 done; remaining: time tracking, expenses, recurring, reports).

---

## Self-review

**Spec coverage:** §2 tab/gating → Task 3. §3 storage/bucket/RLS → Task 1. §4.1 branding API → Task 2. §4.2 BrandingTab → Task 3. §4.3 Profile wiring → Task 3 Step 2. §5 tier consistency → Task 3 (`hasFeature` gate). §6 no-logo → Task 3 (business-name fallback in preview + invoice already). §7 errors → Task 2 (`validateLogoFile` throws AppError) + Task 3 toasts. §8 testing → Tasks 2 (unit) + 4 (Playwright). Covered.

**Type/name consistency:** API exports (`validateLogoFile`, `logoPathFromUrl`, `LOGO_MAX_BYTES`, `LOGO_TYPES`, `uploadLogo`, `removeLogo`) match across Tasks 2–3. `FEATURES.CUSTOM_BRANDING` + `UpgradeCard({feature,currentTier,target})` match the actual components. Profile fields (`logo_url`, `invoice_accent_color`, `invoice_footer`) match the existing schema.

**Note for the executor:** the `<input type=color>` and the hex `<Input>` both `register('invoice_accent_color')` — they two-way sync through the same react-hook-form field (expected). Confirm `UPGRADE_COPY[FEATURES.CUSTOM_BRANDING]` exists (it does — "Brand your invoices") so the UpgradeCard renders for free users.
