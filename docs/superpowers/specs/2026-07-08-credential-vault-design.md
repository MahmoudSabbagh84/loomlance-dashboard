# Credential Vault (Design)

**Status:** Approved 2026-07-08 · **Repo:** LoomLance-Dashboard · **Splash promise:** credential vault *(soon)* — drop the marker on ship.

## Summary

A secure personal vault for the API keys, `.env` secrets, database URLs, and client credentials freelance developers accumulate across projects. Secret values are **encrypted at rest with envelope encryption**; the master key lives only in the edge-function environment, and encrypt/decrypt happen only inside JWT-gated edge functions. The DB holds ciphertext only. Entries are personal (account-scoped) with an optional project link. Validated by the external technical audit as moat/dev-workflow depth; follows the shipped scope-creep and GitHub features.

## Decisions (brainstorming, 2026-07-08)

- **Server-side envelope encryption** (master key in edge env, decrypt in a JWT-gated edge function, ciphertext-only DB) — over zero-knowledge (bigger scope, deferred to a possible v2) and in-DB pgcrypto (weaker key separation).
- **Personal vault, optional project link** — not strictly per-project, not a flat list with no grouping.
- **Entry = label + type + one multiline encrypted secret + optional plaintext context** (username, url, notes) — not structured per-type fields, not a key–value bag.
- **v1 = one dedicated Vault page**; a project-detail credentials panel is a deferred follow-on.
- **No tier-gating in v1** (open pricing decision, deferred — same call as scope-creep).

## Encryption architecture

All crypto runs in edge functions via Deno WebCrypto (`crypto.subtle`), **AES-256-GCM** (authenticated; a tampered ciphertext fails to decrypt rather than returning garbage). GCM output includes the 128-bit auth tag appended to the ciphertext, so each encrypted blob is stored as one value (ciphertext+tag) alongside its nonce.

- **Master key (KEK):** 32 bytes, base64, in edge secret `VAULT_MASTER_KEY`. Never in the DB, client, or logs. (Future hardening: move to a dedicated KMS — documented, not v1.)
- **Per entry (envelope):**
  1. Generate a random 32-byte **DEK**; import as an AES-GCM key.
  2. Encrypt UTF-8(secret) with DEK + random 12-byte `secret_iv` → `secret_ciphertext` (incl. tag).
  3. Wrap: encrypt the raw DEK bytes with KEK + random 12-byte `dek_iv` → `wrapped_dek` (incl. tag).
- **Decrypt:** unwrap DEK (AES-GCM decrypt `wrapped_dek` with KEK+`dek_iv`) → decrypt `secret_ciphertext` with DEK+`secret_iv` → UTF-8 plaintext.
- **Why envelope:** master-key rotation only re-wraps each small DEK, never re-encrypts every secret. `enc_version` (int) lets the scheme evolve.

All four ciphertext/nonce values are stored **base64 text** (avoids bytea/PostgREST hex friction; only the service-role edge function reads/writes them).

Pure crypto module: `supabase/functions/_shared/vaultCrypto.ts`
- `encryptSecret(plaintext: string, kekB64: string): Promise<{ secret_ciphertext, secret_iv, wrapped_dek, dek_iv }>` (all base64 strings)
- `decryptSecret(rec: {secret_ciphertext, secret_iv, wrapped_dek, dek_iv}, kekB64: string): Promise<string>`

## Data model

Table `public.vault_credentials` (RLS owner-only, mirrors existing tables):

```sql
create type vault_credential_type as enum ('api_key','login','database_url','env','ssh_key','note');

create table public.vault_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,   -- optional link
  label text not null,
  type vault_credential_type not null default 'api_key',
  username text,        -- optional identifier (plaintext, searchable)
  url text,             -- optional (plaintext)
  notes text,           -- optional non-secret context (plaintext)
  -- secret (ciphertext only; base64):
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
RLS owner-only means even the ciphertext rows are unreadable by anyone but the owner. Metadata columns are plaintext (searchable); secret columns are ciphertext. No public/anon access at all (unlike invoices/change-requests — the vault has no public surface).

## Edge functions (deployed manually: `npx supabase functions deploy <name>`)

Both mirror the established gate: anon client + caller JWT → `auth.getUser()` (401 if none) → **ownership check** → act with service role. Shared CORS/json via `_shared/cors.ts`. `VAULT_MASTER_KEY` read from env.

- **`vault-store`** — body `{ id?, secret }` (+ the function is called only when the secret is created or changed). Verifies the user; `encryptSecret(secret, KEK)`; writes the four ciphertext columns via service role (insert when no `id`, update when `id` belongs to the caller). Returns `{ id }`. Plaintext never logged/returned.
- **`vault-reveal`** — body `{ id }`. Verifies the caller owns the row; fetches ciphertext (service role); `decryptSecret(...)`; stamps `last_accessed_at = now()`; returns `{ value }`. Never logs the value. Foreign/missing id → 403/404 (no partial reveal). Decrypt failure → clean `{ error: "Couldn't unlock this credential" }`, no crypto internals.

**Metadata-only writes** (label, type, username, url, notes, project_id) and **delete** go through normal RLS'd table access (PostgREST) — they never touch the secret, so they don't need an edge function.

## Reveal / copy flow (UI)

Entries render **masked** (`••••••••`). Per entry: **Reveal** (calls `vault-reveal`, shows plaintext inline, auto-hides after ~30s) and **Copy** (calls `vault-reveal`, writes to clipboard). The list load carries **no secret data** — only metadata — so plaintext is fetched only on an explicit, per-entry action. Each row shows "last viewed" from `last_accessed_at` so unexpected access is visible.

## UI

A top-level **Vault** page — new protected route `/vault` (behind `AuthGate`) + a nav item in `SidebarNav.jsx` (a lock/key icon from `lucide-react`, e.g. `KeyRound`/`Vault` — verify the import resolves).

- **List:** rows with type icon, label, optional username, masked secret + Reveal/Copy, linked project badge, "last viewed"; newest first. `Skeleton` while loading; `EmptyState` explaining the scattered-secrets pain when empty.
- **Search + filters:** search over label/username/url/notes (plaintext); filter by project and by type.
- **Add / edit** (`Modal`): label, type selector, secret (`Textarea` — a whole `.env`/private key pastes in), optional username/url/notes, optional project. Create or secret-change → `vault-store`; metadata-only edit → table update. **On edit the secret field is empty with a "leave blank to keep the current secret" hint** — editing metadata never forces a decrypt; only a typed value re-encrypts.
- **Delete:** `ConfirmDialog` → RLS'd delete.
- Existing kit + Impeccable pass before commit.

Files: `src/api/vault.js` (metadata CRUD via table + `vault-store`/`vault-reveal` via `invokeEdge`), `src/hooks/useVault.js`, `src/pages/VaultPage.jsx`, `src/features/vault/VaultEntryModal.jsx`, route + nav edits.

## Testing

- **Crypto (`_shared/vaultCrypto.ts`):** Deno tests — round-trip (`decrypt(encrypt(x)) === x`), tampered ciphertext throws, wrong KEK throws, two encryptions of the same plaintext differ (random DEK/iv). Run `deno test supabase/functions/_shared/vaultCrypto.test.ts`. If Deno test infra is unavailable, verify round-trip by invoking the deployed `vault-store`→`vault-reveal` against a throwaway ZZ entry, then delete it (no residue).
- **Migration verification (hosted, `begin…rollback`):** insert a ZZ row (dummy ciphertext), confirm owner-only RLS (anon `select` returns 0 rows / no access), `set_updated_at` fires; roll back — zero residue.
- **Component (vitest):** Vault page renders masked entries (no plaintext in the DOM until reveal), Reveal calls the reveal hook and shows the value, add/edit form validation, edit leaves secret blank by default. Mock hooks/edge.
- **E2E (read-only):** log in → Vault page renders; entries masked. No secret create/reveal against live data (edge-function write path covered by the crypto tests + integration probe).

## Out of scope (v1)

Zero-knowledge/client-side encryption; KMS for the master key (documented hardening); a project-detail credentials panel; sharing credentials with clients or teammates; rotation reminders; browser-extension/CLI autofill; bulk `.env` import; and tier-gating (open pricing decision).
