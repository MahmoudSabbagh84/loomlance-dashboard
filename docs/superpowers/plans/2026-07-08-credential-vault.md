# Credential Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A secure personal vault for API keys / `.env` secrets / DB URLs / client credentials, envelope-encrypted at rest, with decrypt only inside JWT-gated edge functions.

**Architecture:** `vault_credentials` table (RLS owner-only, ciphertext-only, no public surface). Portable WebCrypto envelope crypto in `_shared/vaultCrypto.ts` (runs in Deno edge + Node vitest). Two edge functions — `vault-store` (encrypt on create/secret-change) and `vault-reveal` (decrypt one entry on demand). Metadata edits + delete via RLS'd table. A top-level `/vault` page.

**Tech Stack:** Postgres (hosted `zbipqfsqxnvrzhpdjvvy`), Deno edge functions, WebCrypto AES-256-GCM, React 18 + TanStack Query v5 + sonner, vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-07-08-credential-vault-design.md` · **Linear:** "Credential Vault"

## Global Constraints

- Repo: `C:\Users\mahmo\Desktop\LoomLance-Dashboard`. Commit after every task. Do NOT `git push`.
- Migrations via `mcp__supabase__apply_migration`; committed filename must equal the recorded version in `supabase_migrations.schema_migrations`.
- Hosted DB is LIVE PRODUCTION. All migration/RPC verification runs inside `begin … rollback` with ZZ-marked rows — never leave test data.
- **Secrets never in plaintext at rest or in logs.** Master key `VAULT_MASTER_KEY` lives only as a Supabase edge secret. Crypto only inside edge functions.
- Edge functions are security-sensitive → **deploy manually** via `npx supabase functions deploy <name> --project-ref zbipqfsqxnvrzhpdjvvy` (access token in `.env.supabase.local` as `SUPABASE_ACCESS_TOKEN`). Never auto-deploy.
- UI via `@/components/ui/*`; toasts `sonner`; errors `mapPostgresError`/`AppError`; edge calls via `invokeEdge` (`@/api/edge`). Every UI task runs the Impeccable pass before commit.
- Tests: `npx vitest run` (baseline 263 green), `npx playwright test` (admin creds `admin@loomlance.com` / `JSQCNfFApBLxi1Y7uZBX5QXw`).

---

### Task 1: Migration — `vault_credentials` table

**Files:**
- Create: `supabase/migrations/<applied-version>_vault_credentials.sql`

**Interfaces:**
- Produces: table `public.vault_credentials` (RLS owner-only), enum `vault_credential_type`. Consumed by Tasks 3 & 4.

- [ ] **Step 1: Write the migration**

```sql
-- Credential vault: personal, envelope-encrypted secrets. Ciphertext-only at rest; RLS owner-only;
-- NO public surface (unlike invoices/change-requests). All crypto happens in edge functions.
create type vault_credential_type as enum ('api_key','login','database_url','env','ssh_key','note');

create table public.vault_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  label text not null,
  type vault_credential_type not null default 'api_key',
  username text,
  url text,
  notes text,
  secret_ciphertext text not null,
  secret_iv text not null,
  wrapped_dek text not null,
  dek_iv text not null,
  enc_version int not null default 1,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vault_credentials_user_idx on public.vault_credentials (user_id);
create index vault_credentials_project_idx on public.vault_credentials (project_id);

alter table public.vault_credentials enable row level security;
create policy vault_owner_all on public.vault_credentials
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger vault_credentials_set_updated_at
  before update on public.vault_credentials
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Apply via `mcp__supabase__apply_migration`** (name `vault_credentials`); fetch the recorded version; save the file with the matching name.

- [ ] **Step 3: Verify with a rollback probe** (`mcp__supabase__execute_sql`):

```sql
begin;
create temp table log(step text, val text) on commit drop;
create temp table ids on commit drop as select p.user_id uid, p.id pid from public.projects p limit 1;
insert into public.vault_credentials (user_id, project_id, label, type, secret_ciphertext, secret_iv, wrapped_dek, dek_iv)
select uid, pid, 'ZZ vault probe', 'api_key', 'zz', 'zz', 'zz', 'zz' from ids;
insert into log select 'inserted', (select count(*)::text from public.vault_credentials where label='ZZ vault probe');
insert into log select 'updated_at_trigger', (
  select case when updated_at >= created_at then 'ok' else 'bad' end from public.vault_credentials where label='ZZ vault probe');
select * from log order by step;
rollback;
-- anon cannot read the table (RLS has no anon policy)
set role anon; select count(*) as anon_visible from public.vault_credentials; reset role;
select count(*) as residue from public.vault_credentials where label='ZZ vault probe';
```
Expected: `inserted=1`, `updated_at_trigger=ok`, `anon_visible=0`, `residue=0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_vault_credentials.sql
git commit -m "feat(db): vault_credentials table (RLS owner-only, ciphertext-only)"
```

---

### Task 2: Crypto module + tests (TDD)

**Files:**
- Create: `supabase/functions/_shared/vaultCrypto.ts`
- Test: `supabase/functions/_shared/vaultCrypto.test.ts`

**Interfaces:**
- Produces: `encryptSecret(plaintext: string, kekB64: string): Promise<{secret_ciphertext, secret_iv, wrapped_dek, dek_iv}>` (all base64 strings) and `decryptSecret(rec, kekB64): Promise<string>`. Consumed by Task 3. Uses only universal WebCrypto (`globalThis.crypto`) so it runs in Deno and Node.

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/_shared/vaultCrypto.test.ts
import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret } from './vaultCrypto.ts'

// A deterministic 32-byte test KEK (base64).
const KEK = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 1)))

describe('vaultCrypto envelope', () => {
  it('round-trips a secret', async () => {
    const enc = await encryptSecret('sk_live_deadbeef', KEK)
    expect(enc.secret_ciphertext).toBeTruthy()
    expect(await decryptSecret(enc, KEK)).toBe('sk_live_deadbeef')
  })
  it('round-trips a multiline .env blob', async () => {
    const env = 'DB_URL=postgres://x\nAPI_KEY=abc\n'
    expect(await decryptSecret(await encryptSecret(env, KEK), KEK)).toBe(env)
  })
  it('is non-deterministic (unique DEK/iv per call)', async () => {
    const a = await encryptSecret('same', KEK)
    const b = await encryptSecret('same', KEK)
    expect(a.secret_ciphertext).not.toBe(b.secret_ciphertext)
  })
  it('fails to decrypt with the wrong key', async () => {
    const enc = await encryptSecret('secret', KEK)
    const wrong = btoa(String.fromCharCode(...new Uint8Array(32).map(() => 9)))
    await expect(decryptSecret(enc, wrong)).rejects.toThrow()
  })
  it('fails to decrypt tampered ciphertext', async () => {
    const enc = await encryptSecret('secret', KEK)
    const bad = { ...enc, secret_ciphertext: btoa('tampered-nonsense') }
    await expect(decryptSecret(bad, KEK)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run** — `npx vitest run supabase/functions/_shared/vaultCrypto.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// supabase/functions/_shared/vaultCrypto.ts
// Envelope encryption (AES-256-GCM). Portable: uses only globalThis.crypto (Deno + Node 18+).
// The GCM auth tag is appended to the ciphertext by WebCrypto, so each blob is stored as one value.
const b64 = (buf: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function importKek(kekB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', unb64(kekB64), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(plaintext: string, kekB64: string) {
  const kek = await importKek(kekB64)
  const dekRaw = crypto.getRandomValues(new Uint8Array(32))
  const dek = await crypto.subtle.importKey('raw', dekRaw, 'AES-GCM', false, ['encrypt', 'decrypt'])
  const secretIv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: secretIv }, dek, new TextEncoder().encode(plaintext))
  const dekIv = crypto.getRandomValues(new Uint8Array(12))
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: dekIv }, kek, dekRaw)
  return {
    secret_ciphertext: b64(ct),
    secret_iv: b64(secretIv.buffer),
    wrapped_dek: b64(wrapped),
    dek_iv: b64(dekIv.buffer),
  }
}

export async function decryptSecret(
  rec: { secret_ciphertext: string; secret_iv: string; wrapped_dek: string; dek_iv: string },
  kekB64: string,
): Promise<string> {
  const kek = await importKek(kekB64)
  const dekRaw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.dek_iv) }, kek, unb64(rec.wrapped_dek))
  const dek = await crypto.subtle.importKey('raw', dekRaw, 'AES-GCM', false, ['encrypt', 'decrypt'])
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.secret_iv) }, dek, unb64(rec.secret_ciphertext))
  return new TextDecoder().decode(pt)
}
```

- [ ] **Step 4: Run** — `npx vitest run supabase/functions/_shared/vaultCrypto.test.ts` — Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/vaultCrypto.ts supabase/functions/_shared/vaultCrypto.test.ts
git commit -m "feat(vault): portable WebCrypto envelope encrypt/decrypt + tests"
```

---

### Task 3: Edge functions `vault-store` + `vault-reveal` (+ master key, deploy, integration probe)

**Files:**
- Create: `supabase/functions/vault-store/index.ts`, `supabase/functions/vault-reveal/index.ts`

**Interfaces:**
- Consumes: `_shared/cors.ts` (`corsHeadersFor`, `json`), `_shared/vaultCrypto.ts`, `vault_credentials` table.
- Produces: `vault-store` (body `{id?, label?, type?, username?, url?, notes?, project_id?, secret}` → `{id}`) and `vault-reveal` (body `{id}` → `{value}`). Consumed by Task 4.

- [ ] **Step 1: Generate + set the master key** (owner-side secret; do first so deploys can run):

```bash
# 32 random bytes, base64
KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
# set as an edge secret (token from .env.supabase.local)
set -a; . ./.env.supabase.local; set +a
npx supabase secrets set VAULT_MASTER_KEY="$KEY" --project-ref zbipqfsqxnvrzhpdjvvy
```
Expected: "Finished supabase secrets set." If the CLI/token is unavailable in this environment, STOP and hand the two commands to the owner to run, then continue.

- [ ] **Step 2: Write `vault-store/index.ts`**

```ts
// vault-store — authenticated, owner-only. Encrypts a secret (envelope) and upserts the row.
// Called ONLY on create or when the secret changes; metadata-only edits go through the table.
// Deploy: supabase functions deploy vault-store
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { encryptSecret } from '../_shared/vaultCrypto.ts'

Deno.serve(async (req) => {
  const json = (o: unknown, s = 200) => jsonBase(o, s, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const kek = Deno.env.get('VAULT_MASTER_KEY')
    if (!kek) return json({ error: 'Vault not configured' }, 500)
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const body = await req.json().catch(() => ({}))
    const secret = typeof body?.secret === 'string' ? body.secret : ''
    if (!secret) return json({ error: 'A secret value is required' }, 400)

    const enc = await encryptSecret(secret, kek)
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const meta = {
      label: body.label, type: body.type, username: body.username ?? null,
      url: body.url ?? null, notes: body.notes ?? null, project_id: body.project_id ?? null,
    }

    if (body.id) {
      // Update: ownership-scoped; touch metadata (when provided) + the four ciphertext columns.
      const patch: Record<string, unknown> = { ...enc, enc_version: 1 }
      for (const k of ['label', 'type', 'username', 'url', 'notes', 'project_id'] as const) {
        if (body[k] !== undefined) patch[k] = meta[k]
      }
      const { data, error } = await service.from('vault_credentials')
        .update(patch).eq('id', body.id).eq('user_id', user.id).select('id').single()
      if (error || !data) return json({ error: 'Not found' }, 404)
      return json({ id: data.id })
    }

    if (!meta.label || !meta.type) return json({ error: 'Label and type are required' }, 400)
    const { data, error } = await service.from('vault_credentials')
      .insert({ user_id: user.id, ...meta, ...enc }).select('id').single()
    if (error) return json({ error: 'Could not save credential' }, 400)
    return json({ id: data.id })
  } catch (_e) {
    return json({ error: 'Something went wrong' }, 500)
  }
})
```

- [ ] **Step 3: Write `vault-reveal/index.ts`**

```ts
// vault-reveal — authenticated, owner-only. Decrypts ONE entry on demand; stamps last_accessed_at.
// Never logs the value. Deploy: supabase functions deploy vault-reveal
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { decryptSecret } from '../_shared/vaultCrypto.ts'

Deno.serve(async (req) => {
  const json = (o: unknown, s = 200) => jsonBase(o, s, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const kek = Deno.env.get('VAULT_MASTER_KEY')
    if (!kek) return json({ error: 'Vault not configured' }, 500)
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const body = await req.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : null
    if (!id) return json({ error: 'Missing id' }, 400)

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const { data: rec } = await service.from('vault_credentials')
      .select('secret_ciphertext, secret_iv, wrapped_dek, dek_iv')
      .eq('id', id).eq('user_id', user.id).single()
    if (!rec) return json({ error: 'Not found' }, 404)

    let value: string
    try {
      value = await decryptSecret(rec, kek)
    } catch (_e) {
      return json({ error: "Couldn't unlock this credential" }, 422)
    }
    await service.from('vault_credentials').update({ last_accessed_at: new Date().toISOString() }).eq('id', id)
    return json({ value })
  } catch (_e) {
    return json({ error: 'Something went wrong' }, 500)
  }
})
```

- [ ] **Step 4: Deploy both**

```bash
set -a; . ./.env.supabase.local; set +a
npx supabase functions deploy vault-store --project-ref zbipqfsqxnvrzhpdjvvy
npx supabase functions deploy vault-reveal --project-ref zbipqfsqxnvrzhpdjvvy
```
Expected: both "Deployed Function". If CLI unavailable, hand these commands to the owner.

- [ ] **Step 5: Integration probe (round-trip, then clean up)** — with the app or a token, or defer to the Task 6 manual check. Minimal SQL-side confirmation that a row written by `vault-store` decrypts is covered by the crypto unit tests + the Task 6 live check; do not seed a persistent row here (production). Mark done when both functions deploy without error.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/vault-store/index.ts supabase/functions/vault-reveal/index.ts
git commit -m "feat(vault): vault-store + vault-reveal edge functions (envelope crypto, owner-gated)"
```

---

### Task 4: API + hooks

**Files:**
- Create: `src/api/vault.js`, `src/hooks/useVault.js`

**Interfaces:**
- Consumes: `invokeEdge` (`@/api/edge`), `supabase` (`@/lib/supabase`), `mapPostgresError`.
- Produces: hooks `useVaultCredentials()`, `useSaveVaultCredential()`, `useUpdateVaultMetadata()`, `useDeleteVaultCredential()`, `useRevealVaultSecret()`.

- [ ] **Step 1: `src/api/vault.js`**

```javascript
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { invokeEdge } from '@/api/edge'

// Metadata only — never the ciphertext columns (useless client-side; keeps payloads lean).
const META_COLS = 'id, project_id, label, type, username, url, notes, last_accessed_at, created_at'

export async function listVaultCredentials() {
  const { data, error } = await supabase.from('vault_credentials').select(META_COLS)
    .order('created_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data
}

// Create, or update WITH a new secret — routes through the edge function (only it can encrypt).
export async function saveVaultCredentialWithSecret(input) {
  return invokeEdge('vault-store', input) // { id?, label, type, username, url, notes, project_id, secret } -> { id }
}

// Metadata-only edit — no secret change, so it goes straight through the RLS'd table.
export async function updateVaultMetadata(id, patch) {
  const { error } = await supabase.from('vault_credentials').update(patch).eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function deleteVaultCredential(id) {
  const { error } = await supabase.from('vault_credentials').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function revealVaultSecret(id) {
  const { value } = await invokeEdge('vault-reveal', { id })
  return value
}
```

- [ ] **Step 2: `src/hooks/useVault.js`**

```javascript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/vault'

export function useVaultCredentials() {
  return useQuery({ queryKey: ['vault'], queryFn: api.listVaultCredentials })
}

function useVaultMutation(fn) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }) })
}

export function useSaveVaultCredential() { return useVaultMutation(api.saveVaultCredentialWithSecret) }
export function useUpdateVaultMetadata() { return useVaultMutation(({ id, patch }) => api.updateVaultMetadata(id, patch)) }
export function useDeleteVaultCredential() { return useVaultMutation(api.deleteVaultCredential) }

// Reveal is not cached — it fetches plaintext on demand and the caller shows it transiently.
export function useRevealVaultSecret() {
  return useMutation({ mutationFn: api.revealVaultSecret })
}
```

- [ ] **Step 3: Verify** — `npx vitest run` (all green; hooks exercised in Task 5) and `npx vite build`.

- [ ] **Step 4: Commit**

```bash
git add src/api/vault.js src/hooks/useVault.js
git commit -m "feat(vault): API + react-query hooks"
```

---

### Task 5: Vault page + entry modal + route + nav (TDD + Impeccable)

**Files:**
- Create: `src/pages/VaultPage.jsx`, `src/features/vault/VaultEntryModal.jsx`
- Modify: `src/app/routes.jsx` (protected `/vault` route), `src/components/layout/SidebarNav.jsx` (nav item)
- Test: `src/pages/__tests__/VaultPage.test.jsx`

**Interfaces:**
- Consumes: hooks from Task 4; kit components; `relativeTime` (`@/lib/date`).

- [ ] **Step 1: Write the failing tests** — mock `@/hooks/useVault` + `sonner`; render under `MemoryRouter`. Cases:

```jsx
// 1. renders an entry's label + type + MASKED secret (screen shows no plaintext; a •••• placeholder present)
// 2. clicking Reveal calls the reveal mutation with the entry id and then shows the returned value
// 3. empty state renders when there are no credentials
// 4. clicking "New credential" opens the modal (heading visible)
// 5. filtering by type narrows the list (render two types, apply filter, assert one hidden)
// Provide a fake list via useVaultCredentials mock; useRevealVaultSecret mock returns { mutate } that
// invokes options.onSuccess('sk_live_x').
```

- [ ] **Step 2: Run** — `npx vitest run src/pages/__tests__/VaultPage.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Implement**

`VaultEntryModal.jsx` — kit `Modal` titled "New credential" / "Edit credential". Fields: label (`Input`, required), type (`Select`/native select over the 6 enum values), secret (`Textarea` — placeholder "Paste the key, token, connection string, or .env"), optional username, url, notes (`Input`/`Textarea`), optional project (`Select` of the user's projects — reuse `useProjects`). **On edit:** metadata prefilled, secret field EMPTY with hint "Leave blank to keep the current secret." On submit:
- creating, or secret non-empty → `useSaveVaultCredential().mutateAsync({ id?, label, type, username, url, notes, project_id, secret })`
- editing with blank secret → `useUpdateVaultMetadata().mutateAsync({ id, patch: { label, type, username, url, notes, project_id } })`
Validate: label required; on create, secret required. Toast + close on success.

`VaultPage.jsx`:
```jsx
import { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Plus, Eye, EyeOff, Copy, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { VaultEntryModal } from '@/features/vault/VaultEntryModal'
import { useVaultCredentials, useRevealVaultSecret, useDeleteVaultCredential } from '@/hooks/useVault'
import { relativeTime } from '@/lib/date'

const TYPE_LABEL = { api_key: 'API key', login: 'Login', database_url: 'Database URL', env: '.env', ssh_key: 'SSH key', note: 'Note' }

export default function VaultPage() {
  const { data: rows, isLoading } = useVaultCredentials()
  const reveal = useRevealVaultSecret()
  const del = useDeleteVaultCredential()
  const [editing, setEditing] = useState(null)   // entry or {} for new, null = closed
  const [confirmId, setConfirmId] = useState(null)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [shown, setShown] = useState({})          // id -> plaintext (transient)

  const revealInto = (id, then) =>
    reveal.mutate(id, {
      onSuccess: (value) => then(value),
      onError: (e) => toast.error(e.userMessage || e.message),
    })
  const onReveal = (id) => revealInto(id, (value) => {
    setShown((s) => ({ ...s, [id]: value }))
    setTimeout(() => setShown((s) => ({ ...s, [id]: undefined })), 30000)
  })
  const onCopy = (id) => revealInto(id, async (value) => {
    try { await navigator.clipboard.writeText(value); toast.success('Copied') } catch { toast.error('Could not copy') }
  })

  const filtered = (rows ?? []).filter((r) =>
    (!typeFilter || r.type === typeFilter) &&
    (!q || `${r.label} ${r.username ?? ''} ${r.url ?? ''} ${r.notes ?? ''}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <div className="space-y-4">
      <PageHeader title="Vault" subtitle="Encrypted API keys, secrets, and client credentials.">
        <Button onClick={() => setEditing({})}><Plus className="size-4" /> New credential</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-border bg-bg px-3 text-sm">
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !filtered.length ? (
        <EmptyState icon={KeyRound} title="No credentials yet"
          description="Stop scattering API keys and .env secrets across notes and chats. Store them here, encrypted." />
      ) : (
        <Card className="divide-y divide-border p-0">
          {filtered.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
              <KeyRound className="size-4 shrink-0 text-fg-subtle" />
              <span className="font-medium text-fg">{r.label}</span>
              <Badge variant="default">{TYPE_LABEL[r.type] ?? r.type}</Badge>
              {r.username ? <span className="text-sm text-fg-muted">{r.username}</span> : null}
              <code className="font-mono text-sm text-fg-muted">{shown[r.id] ?? '••••••••'}</code>
              <span className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" aria-label={shown[r.id] ? 'Hide' : 'Reveal'}
                  onClick={() => (shown[r.id] ? setShown((s) => ({ ...s, [r.id]: undefined })) : onReveal(r.id))}>
                  {shown[r.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                <Button size="sm" variant="ghost" aria-label="Copy" onClick={() => onCopy(r.id)}><Copy className="size-4" /></Button>
                <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(r)}><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => setConfirmId(r.id)}><Trash2 className="size-4" /></Button>
              </span>
              {r.last_accessed_at ? <span className="w-full text-xs text-fg-subtle">Last viewed {relativeTime(r.last_accessed_at)}</span> : null}
            </div>
          ))}
        </Card>
      )}

      {editing !== null && <VaultEntryModal open entry={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!confirmId} title="Delete credential?"
        description="This permanently deletes the credential." confirmLabel="Delete"
        onConfirm={() => { del.mutate(confirmId, { onSuccess: () => toast.success('Deleted') }); setConfirmId(null) }}
        onCancel={() => setConfirmId(null)} />
    </div>
  )
}
```
Reconcile `PageHeader` children, `Select`/native select, `ConfirmDialog` prop names against real kit usages (mirror an existing page like `InvoicesPage`/`ExpensesPage`). Keep tested roles/text intact.

`routes.jsx`: add `{ path: 'vault', element: <VaultPage /> }` under the protected children (with the other authed pages). `SidebarNav.jsx`: add `{ to: '/vault', label: 'Vault', icon: KeyRound }` to the nav array (import `KeyRound` from `lucide-react`; verify it resolves).

- [ ] **Step 4: Run** — `npx vitest run` (all pass), `npx vite build`. Run the **Impeccable pass** on the page + modal.

- [ ] **Step 5: Commit**

```bash
git add src/pages/VaultPage.jsx src/features/vault/VaultEntryModal.jsx src/app/routes.jsx src/components/layout/SidebarNav.jsx src/pages/__tests__/VaultPage.test.jsx
git commit -m "feat(vault): Vault page — list, reveal/copy, add/edit, filters, nav + route"
```

---

### Task 6: E2E (read-only) + full verification + review + finish

**Files:**
- Create: `tests/e2e/vault.spec.js`

- [ ] **Step 1: Write the spec** — READ-ONLY (no secret create/reveal against live data):

```javascript
import { test, expect } from '@playwright/test'
const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('vault page loads for an authenticated user', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')
  await page.getByRole('link', { name: 'Vault' }).click()
  await expect(page.getByRole('heading', { name: 'Vault' })).toBeVisible()
  await expect(page.getByRole('button', { name: /new credential/i })).toBeVisible()
})
```

- [ ] **Step 2: Run** — `E2E_USER_EMAIL=admin@loomlance.com E2E_USER_PASSWORD=<pw> npx playwright test tests/e2e/vault.spec.js` — Expected: PASS.

- [ ] **Step 3: Manual live check** (owner, post-merge): create a real credential through the UI, reveal it, copy it, edit its label (confirm no decrypt needed), delete it. Confirms the deployed edge functions + master key work end to end.

- [ ] **Step 4: Full suite** — `npx vitest run` and `npx playwright test` (all green).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/vault.spec.js
git commit -m "test(e2e): vault page loads for an authenticated user"
```

---

## Self-review notes

- **Spec coverage:** table + RLS + no-public-surface (T1); portable envelope crypto + tests (T2); two owner-gated edge functions + master key + manual deploy (T3); API/hooks with metadata-vs-secret split (T4); Vault page — masked list, on-demand reveal/copy, add/edit (blank-secret-on-edit), search + type/project filters, delete, nav + route (T5); read-only e2e + manual live check (T6). Out-of-scope items (zero-knowledge, KMS, project panel, sharing, tier-gating) untouched.
- **Type consistency:** crypto record shape `{secret_ciphertext, secret_iv, wrapped_dek, dek_iv}` identical in T1/T2/T3; `vault-store`/`vault-reveal` bodies match between T3 and T4; hook names in T4 match imports in T5.
- **Known unknowns for the implementer:** exact kit prop names for `PageHeader` children / `ConfirmDialog` / select styling (T5 reconciles against `InvoicesPage`/`ExpensesPage`); that `KeyRound` resolves in the installed `lucide-react` (swap to `Lock`/`Vault` if not); and whether the CLI/token is available for T3 secret-set + deploy (fall back to handing the owner the commands).
```
