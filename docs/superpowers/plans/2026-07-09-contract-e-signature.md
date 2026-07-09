# Contract E-Signature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client sign a contract on a hosted `/c/:token` page (typed name + drawn signature + consent), flipping it to `active`, notifying the freelancer, and producing a downloadable signed certificate PDF.

**Architecture:** Extend `contracts` (no new table) with a `sent` status + signature columns. Token-gated SECURITY DEFINER RPCs mirror the change-request flow. A send-time client call stores a long-expiry signed PDF URL so the read RPC stays pure. Public page uses a self-contained `SignaturePad` canvas; the certificate is client-side react-pdf.

**Tech Stack:** Postgres (hosted `zbipqfsqxnvrzhpdjvvy`, pgcrypto), React 18 + React Router v6 + TanStack Query v5 + sonner, `@react-pdf/renderer`, vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-07-09-contract-e-signature-design.md` · **Linear:** "Contract E-Signature"

## Global Constraints

- Repo `C:\Users\mahmo\Desktop\LoomLance-Dashboard`. Commit after every task. Do NOT `git push`.
- Migrations via `mcp__supabase__apply_migration`; committed filename == recorded version in `supabase_migrations.schema_migrations`.
- Hosted DB is LIVE PRODUCTION. All migration/RPC verification runs in `begin … rollback` with ZZ rows — never leave test data.
- **The enum value `sent` is added in its OWN migration (Task 1), before any migration/RPC uses it** — Postgres 15 forbids using a newly-added enum value in the same transaction that adds it.
- RLS keeps `contracts` owner-only; anon reaches contracts only via the token-gated RPCs. Owner RPCs get `revoke ... from public, anon`.
- UI via `@/components/ui/*`; toasts `sonner`; errors `mapPostgresError`; public link base `import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin`, path `/c/<token>`. Every UI task runs the Impeccable pass before commit.
- ⚠️ react-pdf renders only in a prod build — verify the certificate visually via `npm run preview`, not the dev server.
- Tests: `npx vitest run` (baseline 273 green), `npx playwright test` (admin creds `admin@loomlance.com` / `JSQCNfFApBLxi1Y7uZBX5QXw`).

---

### Task 1: Migration A — add the `sent` enum value

**Files:** Create `supabase/migrations/<version>_contract_status_sent.sql`

- [ ] **Step 1: Apply** via `mcp__supabase__apply_migration` (name `contract_status_sent`), body exactly:

```sql
alter type contract_status add value if not exists 'sent' before 'active';
```

- [ ] **Step 2: Verify** — `mcp__supabase__execute_sql`:

```sql
select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
where t.typname = 'contract_status' order by e.enumsortorder;
```
Expected: `draft, sent, active, completed, expired, canceled`.

- [ ] **Step 3: Save the file** with the recorded version name and **commit**:

```bash
git add supabase/migrations/*_contract_status_sent.sql
git commit -m "feat(db): add 'sent' to contract_status enum"
```

---

### Task 2: Migration B — signature columns + RPCs

**Files:** Create `supabase/migrations/<version>_contract_signing.sql`

**Interfaces produced (consumed by Tasks 4):**
- `send_contract(uuid) -> text`, `regenerate_contract_link(uuid) -> text` (owner-only)
- `get_public_contract(text) -> jsonb`, `sign_contract(text, text, text, boolean) -> jsonb`, `decline_contract(text, text) -> jsonb` (anon)

- [ ] **Step 1: Write the migration**

```sql
alter table public.contracts
  add column public_token text unique,
  add column link_expires_at timestamptz,
  add column signing_pdf_url text,
  add column sent_at timestamptz,
  add column signed_at timestamptz,
  add column signer_name text,
  add column signature_image text,
  add column signer_ip text,
  add column signer_user_agent text,
  add column content_hash text,
  add column declined_at timestamptz,
  add column decline_reason text;
create index contracts_public_token_idx on public.contracts (public_token);

-- Owner: issue link + mark sent.
create or replace function public.send_contract(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  update public.contracts
     set status = case when status = 'draft' then 'sent'::contract_status else status end,
         sent_at = coalesce(sent_at, now()),
         public_token = coalesce(public_token, encode(extensions.gen_random_bytes(16), 'hex'))
   where id = p_id and user_id = auth.uid()
   returning public_token into v_token;
  return v_token;
end; $$;

-- Owner: rotate link.
create or replace function public.regenerate_contract_link(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  update public.contracts set public_token = v_token where id = p_id and user_id = auth.uid();
  if not found then return null; end if;
  return v_token;
end; $$;

-- Public read: curated fields by token.
create or replace function public.get_public_contract(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select ct.id, ct.title, ct.description, ct.value, ct.currency, ct.start_date, ct.end_date,
         ct.status, ct.signing_pdf_url, ct.signed_at, ct.signer_name, ct.link_expires_at,
         p.business_name, p.logo_url, p.invoice_accent_color,
         cl.name as client_name
    into c
    from public.contracts ct
    join public.profiles p on p.id = ct.user_id
    left join public.clients cl on cl.id = ct.client_id
   where ct.public_token = p_token;
  if not found then return null; end if;
  if c.link_expires_at is not null and c.link_expires_at < now() then return null; end if;
  return jsonb_build_object(
    'title', c.title, 'description', c.description, 'value', c.value, 'currency', c.currency,
    'start_date', c.start_date, 'end_date', c.end_date, 'status', c.status,
    'signing_pdf_url', c.signing_pdf_url, 'already_signed', c.signed_at is not null,
    'signer_name', c.signer_name, 'signed_at', c.signed_at,
    'business_name', c.business_name, 'logo_url', c.logo_url, 'accent_color', c.invoice_accent_color,
    'client_name', c.client_name);
end; $$;

-- Public write: sign. Idempotent — only a 'sent' contract is signable.
create or replace function public.sign_contract(p_token text, p_signer_name text, p_signature_image text, p_consent boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record; v_headers json; v_hash text;
begin
  select * into c from public.contracts where public_token = p_token;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if c.link_expires_at is not null and c.link_expires_at < now() then return jsonb_build_object('error', 'not_found'); end if;
  if c.status <> 'sent' then return jsonb_build_object('status', c.status, 'already', true); end if;
  if coalesce(p_consent, false) is not true or coalesce(btrim(p_signer_name), '') = '' or coalesce(p_signature_image, '') = '' then
    return jsonb_build_object('error', 'invalid');
  end if;

  v_headers := nullif(current_setting('request.headers', true), '')::json;
  v_hash := encode(extensions.digest(
    concat_ws('|', c.title, coalesce(c.description,''), coalesce(c.value::text,''), c.currency,
              coalesce(c.start_date::text,''), coalesce(c.end_date::text,'')), 'sha256'), 'hex');

  update public.contracts
     set status = 'active'::contract_status, signed_at = now(), signer_name = btrim(p_signer_name),
         signature_image = p_signature_image, content_hash = v_hash,
         signer_ip = coalesce(v_headers->>'x-forwarded-for', ''),
         signer_user_agent = coalesce(v_headers->>'user-agent', '')
   where id = c.id;

  insert into public.user_notifications (user_id, kind, payload, link_to)
  values (c.user_id, 'contract_signed',
          jsonb_build_object('title', 'Contract signed', 'body', c.title || ' was signed by ' || btrim(p_signer_name)),
          '/contracts/' || c.id::text);
  return jsonb_build_object('status', 'active', 'ok', true, 'content_hash', v_hash);
end; $$;

-- Public write: decline.
create or replace function public.decline_contract(p_token text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.contracts where public_token = p_token;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if c.status <> 'sent' then return jsonb_build_object('status', c.status, 'already', true); end if;
  update public.contracts set status = 'canceled'::contract_status, declined_at = now(), decline_reason = p_reason where id = c.id;
  insert into public.user_notifications (user_id, kind, payload, link_to)
  values (c.user_id, 'contract_declined',
          jsonb_build_object('title', 'Contract declined', 'body', c.title || ' was declined'),
          '/contracts/' || c.id::text);
  return jsonb_build_object('status', 'canceled', 'ok', true);
end; $$;

revoke all on function public.send_contract(uuid) from public, anon;
revoke all on function public.regenerate_contract_link(uuid) from public, anon;
grant execute on function public.send_contract(uuid) to authenticated;
grant execute on function public.regenerate_contract_link(uuid) to authenticated;
grant execute on function public.get_public_contract(text) to anon, authenticated;
grant execute on function public.sign_contract(text, text, text, boolean) to anon, authenticated;
grant execute on function public.decline_contract(text, text) to anon, authenticated;
```

- [ ] **Step 2: Apply** (name `contract_signing`); fetch the recorded version; save the file with that name.

- [ ] **Step 3: Rollback probe** — simulate the owner JWT for `send_contract` (auth.uid() is null in the SQL editor otherwise):

```sql
begin;
create temp table log(step text, val text) on commit drop;
create temp table ids on commit drop as select c.user_id uid, c.id cid from public.contracts c where c.status='draft' limit 1;
-- if no draft contract exists, insert a ZZ one
insert into public.contracts (user_id, client_id, title, currency, status)
select p.user_id, p.client_id, 'ZZ sign probe', 'USD', 'draft' from public.projects p
where not exists (select 1 from ids) limit 1;
update ids set uid = c.user_id, cid = c.id from public.contracts c where c.title='ZZ sign probe';

select set_config('request.jwt.claims', json_build_object('sub',(select uid from ids),'role','authenticated')::text, true);
insert into log select 'send_token', (public.send_contract((select cid from ids)) is not null)::text;
select set_config('request.jwt.claims','',true);

insert into log select 'public_status', public.get_public_contract((select public_token from public.contracts where id=(select cid from ids)))->>'status';
insert into log select 'sign1', public.sign_contract((select public_token from public.contracts where id=(select cid from ids)), 'Jane Client', 'data:image/png;base64,ZZ', true)->>'ok';
insert into log select 'sign2_already', public.sign_contract((select public_token from public.contracts where id=(select cid from ids)), 'Someone', 'data:image/png;base64,ZZ', true)->>'already';
insert into log select 'final_status', (select status::text from public.contracts where id=(select cid from ids));
insert into log select 'has_hash', (select (content_hash is not null)::text from public.contracts where id=(select cid from ids));
insert into log select 'notif', (select count(*)::text from public.user_notifications where kind='contract_signed' and created_at > now() - interval '1 minute');
select * from log order by step;
rollback;
set role anon; select count(*) as anon_rows from public.contracts; reset role;
```
Expected: `send_token=true`, `public_status=sent`, `sign1=true`, `sign2_already=true`, `final_status=active`, `has_hash=true`, `notif=1`, `anon_rows=0`.

- [ ] **Step 4: Commit** — `git add supabase/migrations/*_contract_signing.sql && git commit -m "feat(db): contract signing columns + send/get/sign/decline RPCs"`

---

### Task 3: Pure helpers (TDD)

**Files:** Create `src/lib/contractSignature.js`, Test `src/lib/__tests__/contractSignature.test.js`

**Interfaces produced:** `canSign(status) -> boolean` (true only for `'sent'`); `validSignInput({ name, consent, signatureImage }) -> boolean` (all present/true).

- [ ] **Step 1: Failing tests**

```javascript
import { describe, it, expect } from 'vitest'
import { canSign, validSignInput } from '@/lib/contractSignature'

describe('canSign', () => {
  it('is true only for a sent contract', () => {
    expect(canSign('sent')).toBe(true)
    expect(canSign('draft')).toBe(false)
    expect(canSign('active')).toBe(false)
  })
})
describe('validSignInput', () => {
  it('requires a name, consent, and a signature image', () => {
    expect(validSignInput({ name: 'Jane', consent: true, signatureImage: 'data:...' })).toBe(true)
    expect(validSignInput({ name: '', consent: true, signatureImage: 'data:...' })).toBe(false)
    expect(validSignInput({ name: 'Jane', consent: false, signatureImage: 'data:...' })).toBe(false)
    expect(validSignInput({ name: 'Jane', consent: true, signatureImage: '' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run** — `npx vitest run src/lib/__tests__/contractSignature.test.js` — FAIL.

- [ ] **Step 3: Implement**

```javascript
// src/lib/contractSignature.js — pure guards for contract signing.
export function canSign(status) {
  return status === 'sent'
}
export function validSignInput({ name, consent, signatureImage } = {}) {
  return Boolean(name && name.trim()) && consent === true && Boolean(signatureImage)
}
```

- [ ] **Step 4: Run** — PASS. **Step 5: Commit** — `git add src/lib/contractSignature.js src/lib/__tests__/contractSignature.test.js && git commit -m "feat(contracts): pure signing guards"`

---

### Task 4: API + hooks

**Files:** Create `src/api/publicContract.js`, `src/hooks/usePublicContract.js`; Modify `src/api/contracts.js`, `src/hooks/useContracts.js`

**Interfaces produced:** `getPublicContract(token)`, `signContract({token,name,signatureImage,consent})`, `declineContract({token,reason})`; owner: `sendContract(id)`, `regenerateContractLink(id)`, `storeSigningUrl(id, path)`; hooks `usePublicContract(token)`, `useSignContract()`, `useSendContract()`, `useRegenerateContractLink()`.

- [ ] **Step 1: `src/api/publicContract.js`**

```javascript
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function getPublicContract(token) {
  const { data, error } = await supabase.rpc('get_public_contract', { p_token: token })
  if (error) throw mapPostgresError(error)
  return data
}
export async function signContract({ token, name, signatureImage, consent }) {
  const { data, error } = await supabase.rpc('sign_contract', {
    p_token: token, p_signer_name: name, p_signature_image: signatureImage, p_consent: consent,
  })
  if (error) throw mapPostgresError(error)
  return data
}
export async function declineContract({ token, reason }) {
  const { data, error } = await supabase.rpc('decline_contract', { p_token: token, p_reason: reason ?? null })
  if (error) throw mapPostgresError(error)
  return data
}
```

- [ ] **Step 2: Append to `src/api/contracts.js`** (near `getSignedPdfUrl`):

```javascript
// A long-expiry signed URL for the contract PDF (used for the public signing page).
export async function signedPdfUrlForSigning(path) {
  const { data, error } = await supabase.storage.from('contract-pdfs').createSignedUrl(path, 60 * 60 * 24 * 30)
  if (error) throw error
  return data.signedUrl
}
export async function sendContract(id) {
  const { data, error } = await supabase.rpc('send_contract', { p_id: id })
  if (error) throw mapPostgresError(error)
  return data // token
}
export async function regenerateContractLink(id) {
  const { data, error } = await supabase.rpc('regenerate_contract_link', { p_id: id })
  if (error) throw mapPostgresError(error)
  return data // token
}
export async function storeSigningUrl(id, url) {
  const { error } = await supabase.from('contracts').update({ signing_pdf_url: url }).eq('id', id)
  if (error) throw mapPostgresError(error)
}
// Orchestrates the Send action: issue token, then (if a PDF exists) store its long-lived signed URL.
export async function sendContractForSignature(contract) {
  const token = await sendContract(contract.id)
  if (contract.pdf_storage_path) {
    const url = await signedPdfUrlForSigning(contract.pdf_storage_path)
    await storeSigningUrl(contract.id, url)
  }
  return token
}
```

- [ ] **Step 3: `src/hooks/usePublicContract.js`**

```javascript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as pub from '@/api/publicContract'

export function usePublicContract(token) {
  return useQuery({ queryKey: ['public-contract', token], queryFn: () => pub.getPublicContract(token), enabled: !!token, retry: false })
}
export function useSignContract() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: pub.signContract, onSuccess: (_, { token }) => qc.invalidateQueries({ queryKey: ['public-contract', token] }) })
}
export function useDeclineContract() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: pub.declineContract, onSuccess: (_, { token }) => qc.invalidateQueries({ queryKey: ['public-contract', token] }) })
}
```

- [ ] **Step 4: Append owner hooks to `src/hooks/useContracts.js`** (mirror the file's existing invalidation of `['contracts']` / `['contract', id]`):

```javascript
export function useSendContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (contract) => api.sendContractForSignature(contract),
    onSuccess: (_t, contract) => { qc.invalidateQueries({ queryKey: ['contracts'] }); qc.invalidateQueries({ queryKey: ['contract', contract.id] }) },
  })
}
export function useRegenerateContractLink() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.regenerateContractLink, onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }) })
}
```
Confirm `useContracts.js` already imports `* as api from '@/api/contracts'` and `useQueryClient`/`useMutation` (add if missing) and uses `['contract', id]` for the detail key (match the real key used by `useContract`).

- [ ] **Step 5: Verify** — `npx vitest run` green; `npx vite build` succeeds. **Commit** — `git add src/api/publicContract.js src/hooks/usePublicContract.js src/api/contracts.js src/hooks/useContracts.js && git commit -m "feat(contracts): signing API + hooks"`

---

### Task 5: `SignaturePad` component (TDD + Impeccable)

**Files:** Create `src/features/contracts/SignaturePad.jsx`, Test `src/features/contracts/__tests__/SignaturePad.test.jsx`

**Interfaces produced:** `<SignaturePad value onChange />` — draws on a `<canvas>` (pointer events), `onChange(dataUrl)` on each stroke end, `Clear` button → `onChange('')`.

- [ ] **Step 1: Failing tests** (jsdom has no real canvas, so test the interface, not pixels):

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignaturePad } from '../SignaturePad'

describe('SignaturePad', () => {
  it('renders a canvas and a Clear button', () => {
    render(<SignaturePad value="" onChange={() => {}} />)
    expect(screen.getByLabelText(/signature/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })
  it('Clear resets the signature to empty', async () => {
    const onChange = vi.fn()
    render(<SignaturePad value="data:image/png;base64,x" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(onChange).toHaveBeenCalledWith('')
  })
})
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

```jsx
import { useRef } from 'react'
import { Button } from '@/components/ui/Button'

export function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)

  const ctx = () => canvasRef.current?.getContext('2d') ?? null
  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const start = (e) => {
    const c = ctx(); if (!c) return
    drawing.current = true
    c.lineWidth = 2; c.lineCap = 'round'; c.strokeStyle = '#0f172a'
    const { x, y } = pos(e); c.beginPath(); c.moveTo(x, y)
  }
  const move = (e) => {
    if (!drawing.current) return
    const c = ctx(); if (!c) return
    const { x, y } = pos(e); c.lineTo(x, y); c.stroke()
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange(canvasRef.current?.toDataURL('image/png') ?? '')
  }
  const clear = () => {
    const c = ctx()
    if (c && canvasRef.current) c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    onChange('')
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        aria-label="Signature pad"
        width={480}
        height={160}
        className="w-full touch-none rounded-md border border-border bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="mt-1 flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={clear}>Clear</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run** — PASS. Impeccable pass. **Commit** — `git add src/features/contracts/SignaturePad.jsx src/features/contracts/__tests__/SignaturePad.test.jsx && git commit -m "feat(contracts): SignaturePad canvas component"`

---

### Task 6: Signed certificate PDF (TDD + Impeccable)

**Files:** Create `src/features/contracts/ContractCertificatePDF.jsx`, Test `src/features/contracts/__tests__/ContractCertificatePDF.test.jsx`

**Interfaces produced:** `buildContractCertificateBlob({ contract, client, profile }) -> Promise<Blob>` — `contract` includes `signer_name, signature_image, signed_at, signer_ip, content_hash`.

- [ ] **Step 1: Failing smoke test**

```jsx
import { describe, it, expect } from 'vitest'
import { buildContractCertificateBlob } from '../ContractCertificatePDF'

it('builds a certificate blob for a signed contract', async () => {
  const blob = await buildContractCertificateBlob({
    contract: {
      title: 'Design retainer', description: 'Terms…', value: 5000, currency: 'USD',
      signer_name: 'Jane Client', signature_image: 'data:image/png;base64,iVBORw0KGgo=',
      signed_at: '2026-07-09T00:00:00Z', signer_ip: '1.2.3.4', content_hash: 'abc123',
    },
    client: { name: 'Acme' },
    profile: { business_name: 'DevShop' },
  })
  expect(blob).toBeInstanceOf(Blob)
  expect(blob.size).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run** — `npx vitest run src/features/contracts/__tests__/ContractCertificatePDF.test.jsx` — FAIL.

- [ ] **Step 3: Implement** — mirror `src/features/invoices/InvoicePDF.jsx` (same `@react-pdf/renderer` imports + `pdf(...).toBlob()`):

```jsx
/* eslint-disable react-refresh/only-export-components */
import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: '#0f172a', fontFamily: 'Helvetica' },
  h1: { fontSize: 18, marginBottom: 4 }, muted: { color: '#64748b' },
  section: { marginTop: 18 }, terms: { marginTop: 8, lineHeight: 1.5 },
  block: { marginTop: 24, borderTop: '1 solid #e2e8f0', paddingTop: 14 },
  sig: { height: 70, width: 220, objectFit: 'contain', marginVertical: 6 },
  row: { marginTop: 2 }, label: { color: '#64748b' },
})

function CertificateDocument({ contract, client, profile }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{contract.title}</Text>
        <Text style={s.muted}>{profile.business_name} &middot; {client?.name}</Text>
        <View style={s.section}>
          <Text style={s.label}>Value</Text>
          <Text>{contract.value != null ? formatCurrency(contract.value, contract.currency) : '—'}</Text>
        </View>
        {contract.description ? <View style={s.section}><Text style={s.label}>Terms</Text><Text style={s.terms}>{contract.description}</Text></View> : null}
        <View style={s.block}>
          <Text style={{ fontSize: 13, marginBottom: 6 }}>Electronic signature</Text>
          <Text style={s.row}>Signed by: {contract.signer_name}</Text>
          {contract.signature_image ? <Image style={s.sig} src={contract.signature_image} /> : null}
          <Text style={s.row}><Text style={s.label}>Date: </Text>{contract.signed_at ? formatDate(contract.signed_at) : ''}</Text>
          <Text style={s.row}><Text style={s.label}>IP: </Text>{contract.signer_ip || '—'}</Text>
          <Text style={s.row}><Text style={s.label}>Verification hash: </Text>{contract.content_hash || '—'}</Text>
        </View>
      </Page>
    </Document>
  )
}

export function buildContractCertificateBlob({ contract, client, profile }) {
  return pdf(<CertificateDocument contract={contract} client={client} profile={profile} />).toBlob()
}
```

- [ ] **Step 4: Run** — PASS. Visual check deferred to `npm run preview` (react-pdf is prod-only for rendering; blob generation works headless). **Commit** — `git add src/features/contracts/ContractCertificatePDF.jsx src/features/contracts/__tests__/ContractCertificatePDF.test.jsx && git commit -m "feat(contracts): signed certificate PDF"`

---

### Task 7: Public `/c/:token` signing page (TDD + Impeccable)

**Files:** Create `src/pages/PublicContractPage.jsx`, Test `src/pages/__tests__/PublicContractPage.test.jsx`; Modify `src/app/routes.jsx`

- [ ] **Step 1: Failing tests** — mock `@/hooks/usePublicContract`, `sonner`, and stub `SignaturePad` to expose a "draw" button:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PublicContractPage from '../PublicContractPage'
import { usePublicContract, useSignContract, useDeclineContract } from '@/hooks/usePublicContract'

vi.mock('@/hooks/usePublicContract')
vi.mock('@/features/contracts/SignaturePad', () => ({
  SignaturePad: ({ onChange }) => <button type="button" onClick={() => onChange('data:image/png;base64,x')}>draw</button>,
}))

const sent = { title: 'Design retainer', description: 'Terms', value: 5000, currency: 'USD', status: 'sent', already_signed: false, business_name: 'DevShop', client_name: 'Acme' }
function renderPage(token = 't1') {
  return render(<MemoryRouter initialEntries={[`/c/${token}`]}><Routes><Route path="/c/:token" element={<PublicContractPage />} /></Routes></MemoryRouter>)
}
beforeEach(() => {
  useSignContract.mockReturnValue({ mutate: vi.fn(), isPending: false })
  useDeclineContract.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe('PublicContractPage', () => {
  it('renders the terms and a disabled Sign until name+drawing+consent', async () => {
    usePublicContract.mockReturnValue({ data: sent, isLoading: false })
    renderPage()
    expect(screen.getByText('Design retainer')).toBeInTheDocument()
    const sign = screen.getByRole('button', { name: /^sign$/i })
    expect(sign).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Client')
    await userEvent.click(screen.getByRole('button', { name: /draw/i }))
    await userEvent.click(screen.getByLabelText(/i agree/i))
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeEnabled()
  })
  it('signing calls the mutation with name + signature + consent', async () => {
    const mutate = vi.fn()
    useSignContract.mockReturnValue({ mutate, isPending: false })
    usePublicContract.mockReturnValue({ data: sent, isLoading: false })
    renderPage('t1')
    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Client')
    await userEvent.click(screen.getByRole('button', { name: /draw/i }))
    await userEvent.click(screen.getByLabelText(/i agree/i))
    await userEvent.click(screen.getByRole('button', { name: /^sign$/i }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ token: 't1', name: 'Jane Client', signatureImage: 'data:image/png;base64,x', consent: true }),
      expect.anything())
  })
  it('shows a signed confirmation when already signed', () => {
    usePublicContract.mockReturnValue({ data: { ...sent, status: 'active', already_signed: true, signer_name: 'Jane Client' }, isLoading: false })
    renderPage()
    expect(screen.getByText(/signed/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^sign$/i })).not.toBeInTheDocument()
  })
  it('shows invalid-link for a null payload', () => {
    usePublicContract.mockReturnValue({ data: null, isLoading: false })
    renderPage()
    expect(screen.getByText(/no longer valid/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — mirror `src/pages/PublicChangeRequestPage.jsx` shell (loading skeleton, `!data` → invalid-link card, business-branded). Body: title, parties, value/dates, `description` terms, and if `signing_pdf_url` a "View the full contract (PDF)" link. If `already_signed` (or status not `sent`): a signed confirmation ("Signed by {signer_name}"), a **Download signed certificate** button (calls `buildContractCertificateBlob` with the payload + triggers download), no form. Else a sign form: `Input` name (label "Full name"), `<SignaturePad value={sig} onChange={setSig} />`, a consent checkbox (label contains "I agree"), a **Sign** button disabled until `validSignInput({name, consent, signatureImage: sig})`; on click `useSignContract().mutate({ token, name, signatureImage: sig, consent }, { onSuccess: toast + refetch, onError })`. Use `validSignInput`/`canSign` from `@/lib/contractSignature`. Kit: `Card`/`Button`/`Input`/`Label`/`Skeleton`.

  Route in `src/app/routes.jsx`: add `{ path: '/c/:token', element: <PublicContractPage /> }` next to `/cr/:token`, and import the page.

- [ ] **Step 4: Run** — `npx vitest run src/pages/__tests__/PublicContractPage.test.jsx` PASS; full `npx vitest run`; `npx vite build`. Impeccable pass. **Commit** — `git add src/pages/PublicContractPage.jsx src/pages/__tests__/PublicContractPage.test.jsx src/app/routes.jsx && git commit -m "feat(contracts): public /c/:token signing page"`

---

### Task 8: Contract-detail signature panel (TDD + Impeccable)

**Files:** Create `src/features/contracts/ContractSignaturePanel.jsx`, Test `src/features/contracts/__tests__/ContractSignaturePanel.test.jsx`; Modify `src/pages/ContractDetailPage.jsx` (render `<ContractSignaturePanel contract={contract} />` in the grid)

- [ ] **Step 1: Failing tests** — mock `@/hooks/useContracts` (`useSendContract`, `useRegenerateContractLink`) + `sonner`:

```jsx
// 1. a 'draft' contract shows a "Send for signature" button
// 2. clicking it calls the send mutation with the contract
// 3. a 'sent' contract (has public_token) shows the copy-link control (a link input / Copy button)
// 4. a signed contract (signed_at set) shows the signer name + a "Download signed certificate" button
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** `ContractSignaturePanel.jsx` — a `Card` titled "Signature":
  - `draft` → **"Send for signature"** `Button` → `useSendContract().mutate(contract, { onSuccess: toast 'Ready to share — copy the link', onError })`.
  - has `public_token` and not signed → show the signing URL (`${base}/c/${public_token}`) in a read-only `Input` with **Copy** + **Regenerate** (`useRegenerateContractLink().mutate(contract.id, …)`), mirroring `src/features/invoices/ShareLinkPanel.jsx`.
  - `signed_at` set → "Signed by {signer_name} on {formatDate(signed_at)}" + IP, and a **Download signed certificate** `Button` calling `buildContractCertificateBlob({ contract, client: contract.clients, profile })` (fetch the owner profile via `useProfile`) → download.
  - Render it in `ContractDetailPage.jsx` inside the `grid` (a third cell, or full-width below the grid).

- [ ] **Step 4: Run** — full `npx vitest run` green; `npx vite build`. Impeccable pass. **Commit** — `git add src/features/contracts/ContractSignaturePanel.jsx src/features/contracts/__tests__/ContractSignaturePanel.test.jsx src/pages/ContractDetailPage.jsx && git commit -m "feat(contracts): send-for-signature + signed-record panel"`

---

### Task 9: E2E (read-only) + full verification + finish

**Files:** Create `tests/e2e/contract-signature.spec.js`

- [ ] **Step 1: Write** — READ-ONLY (create a ZZ client + contract, assert the Send control renders; no public signing on live data):

```javascript
import { test, expect } from '@playwright/test'
const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('contract detail shows the signature panel', async ({ page }) => {
  const stamp = Date.now()
  await page.goto('/login')
  await page.locator('#email').fill(EMAIL); await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')
  await page.getByRole('link', { name: 'Clients' }).click()
  await page.getByRole('button', { name: /new client/i }).first().click()
  await page.getByLabel('Name').fill(`ZZ Sig Client ${stamp}`)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(`ZZ Sig Client ${stamp}`).first()).toBeVisible()
  await page.getByRole('link', { name: 'Contracts' }).click()
  await page.getByRole('button', { name: /new contract/i }).first().click()
  await page.getByLabel('Client').selectOption({ label: `ZZ Sig Client ${stamp}` })
  await page.getByLabel('Title').fill(`ZZ Sig Contract ${stamp}`)
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('link', { name: new RegExp(`ZZ Sig Contract ${stamp}`) }).click()
  await expect(page.getByRole('button', { name: /send for signature/i })).toBeVisible()
})
```
Reconcile the contract-create form labels/selectors against the real `ContractFormModal` when writing.

- [ ] **Step 2: Run** — `E2E_USER_EMAIL=admin@loomlance.com E2E_USER_PASSWORD=<pw> npx playwright test tests/e2e/contract-signature.spec.js` — PASS. Clean up ZZ litter via scoped SQL (`delete from contracts where title like 'ZZ Sig Contract %'; delete from clients where name like 'ZZ Sig Client %';`).

- [ ] **Step 3: Full suites** — `npx vitest run` and `npx playwright test` (all green).

- [ ] **Step 4: Commit** — `git add tests/e2e/contract-signature.spec.js && git commit -m "test(e2e): contract signature panel renders"`

---

## Self-review notes

- **Spec coverage:** enum `sent` in its own migration (T1); columns + 5 RPCs incl. idempotent sign, IP/UA capture, content hash, notification (T2); pure guards (T3); API/hooks incl. send-time signed-URL orchestration (T4); SignaturePad (T5); certificate PDF (T6); public signing page with typed+drawn+consent + already-signed + invalid states (T7); detail send/link/signed panel (T8); read-only e2e (T9). Out-of-scope (counter-signature, PDF-byte hash, server cert, emails, tier-gating) untouched.
- **Type consistency:** RPC names/params match T2↔T4; `canSign`/`validSignInput` signatures match T3↔T7; `buildContractCertificateBlob({contract,client,profile})` identical T6↔T7↔T8; `signContract({token,name,signatureImage,consent})` shape identical T4↔T7.
- **Known unknowns:** the contract detail key (`['contract', id]` vs `['contracts', id]` — verify in `useContracts.js` T4); `ContractFormModal` field labels for the e2e (T9); whether `useContracts.js` already imports `useMutation`/`useQueryClient` (T4). Reconcile against the real files while implementing.
```
