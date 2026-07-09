# Contract E-Signature (Design)

**Status:** Approved 2026-07-09 · **Repo:** LoomLance-Dashboard · **Audit gap:** contracts exist but can't be signed.

## Summary

Let a client sign a contract on a hosted `/c/:token` page — reviewing the terms (and the uploaded PDF, if any), then signing with a **typed name + a drawn signature**, explicit consent, and a captured timestamp/IP/content-hash. Signing flips the contract to `active`, notifies the freelancer, and produces a downloadable **signed certificate PDF** for both parties. Mirrors the shipped change-request and public-invoice patterns (token + SECURITY DEFINER RPCs + hosted public page); no new table, no edge function.

## Decisions (brainstorming, 2026-07-09)

- **Typed name + drawn signature** (canvas → base64 PNG stored inline), plus consent checkbox, timestamp, IP, content hash — over typed-only or drawn-only.
- **Generate a signed certificate PDF** (react-pdf, like invoices) — over record-only.
- **v1 = client signs; freelancer is the issuer** (sending = assent). Mutual/counter-signature deferred to v2.
- Reuse the change-request/invoice conventions: token-gated SQL RPCs, hosted public page, bell notification.

## Data model

Extend `public.contracts` (no new table). Signing is a lifecycle on the contract.

- **Enum:** `alter type contract_status add value 'sent'` → `draft → sent → active → completed / expired / canceled`. `sent` = awaiting signature; signing sets `active`. (Applied as its **own** migration first — Postgres 15 forbids *using* a newly-added enum value in the same transaction that adds it; plpgsql RPC bodies resolve the literal at runtime, but a separate migration is the safe, unambiguous ordering.)
- **New columns on `contracts`:**
  - Sharing: `public_token text unique`, `sent_at timestamptz`, `link_expires_at timestamptz`, `signing_pdf_url text` (long-expiry signed URL for the uploaded PDF, generated at send time).
  - Signature record: `signed_at timestamptz`, `signer_name text`, `signature_image text` (base64 PNG of the drawn signature), `signer_ip text`, `signer_user_agent text`, `content_hash text` (SHA-256 of the canonical terms at signing).
  - Decline: `declined_at timestamptz`, `decline_reason text`.
- RLS stays owner-only; anon reaches the contract only through the token-gated RPCs. The drawn PNG lives inline (small) so signing is a single SQL RPC with no anon storage write. Index on `public_token`.

## Backend (token-gated SECURITY DEFINER RPCs, mirroring change-requests)

- `send_contract(p_id)` — owner-guarded (`user_id = auth.uid()`): stamps `status='sent'` (from `draft`), `sent_at=now()`, issues `public_token` if absent; returns the token. (The signed PDF URL is generated client-side at send — see below — because storage signing needs the authenticated client.)
- `regenerate_contract_link(p_id)` — owner-guarded token rotation.
- `get_public_contract(p_token)` — anon read → curated JSON: `business_name`/branding, `client_name`, `title`, `description` (terms), `value`, `currency`, `start_date`, `end_date`, `signing_pdf_url`, `status`, `already_signed` (`signed_at is not null` — precise, since a contract can be `active` without a signature), `signer_name`, `signed_at`. Null on missing/expired token.
- `sign_contract(p_token, p_signer_name, p_signature_image, p_consent)` — anon write. Acts **only if `status='sent'`** (idempotent: already-signed → returns `{status, already:true}`). Requires `p_consent=true` and non-empty name, else `{error}`. On success:
  - sets `signed_at=now()`, `signer_name`, `signature_image`, `status='active'`;
  - `signer_ip := current_setting('request.headers', true)::json->>'x-forwarded-for'`, `signer_user_agent` from the same headers;
  - `content_hash := encode(extensions.digest(concat_ws('|', title, coalesce(description,''), coalesce(value::text,''), currency, coalesce(start_date::text,''), coalesce(end_date::text,'')), 'sha256'), 'hex')`;
  - inserts `user_notifications` (`kind='contract_signed'`, `link_to='/contracts/'||id`).
- `decline_contract(p_token, p_reason)` — anon write; only if `status='sent'` → `status='canceled'`, stamps `declined_at`/`decline_reason`, notifies (`kind='contract_declined'`).
- Grants: `get_public_contract`/`sign_contract`/`decline_contract` → anon + authenticated; `send_contract`/`regenerate_contract_link` → authenticated, with `revoke ... from public, anon` (repo convention for owner RPCs).

**Send-time signed PDF URL:** a client helper generates a ~30-day signed URL for `pdf_storage_path` via `supabase.storage.from('contract-pdfs').createSignedUrl(path, 60*60*24*30)` and saves it to `signing_pdf_url` (a normal owner RLS'd update) as part of the Send action. Keeps `get_public_contract` a pure data RPC.

## UI

**Contract detail page (freelancer):**
- **"Send for signature"** on a `draft`: calls `send_contract`, generates + stores `signing_pdf_url` (if a PDF is attached), reveals the **signing link** with copy + **regenerate** controls (mirror `ShareLinkPanel`). `sent` locks editing (copy/regenerate or withdraw only).
- **Signed state:** a panel showing signer name, signed date, IP, and **"Download signed certificate"**. Status badge gains `Sent`; `active` shown for signed.

**Public `/c/:token` signing page** (`src/pages/PublicContractPage.jsx`, styled like `PublicChangeRequestPage`/`PublicInvoicePage`):
- Review: title, parties, value/dates, terms (`description`), and — if `signing_pdf_url` — a "View the full contract (PDF)" link.
- Sign: typed **full name** (`Input`), a **`SignaturePad`** canvas (`src/features/contracts/SignaturePad.jsx` — pointer events on `<canvas>`, `Clear`, exports `toDataURL('image/png')`, no new dependency), and an **"I agree, and intend this as my electronic signature"** checkbox. **Sign** disabled until name + a non-empty drawing + consent. Success → signed confirmation + client can **Download signed certificate**. Invalid/expired token → "this link is no longer valid." (Optional **Decline** with a reason.)

**Signed certificate PDF** (`src/features/contracts/ContractCertificatePDF.jsx`, `buildContractCertificateBlob({ contract, client, profile, signature })`) — mirrors `InvoicePDF`/`buildInvoiceBlob` with `@react-pdf/renderer`: contract terms, then a signature block ("Signed by {name}", the drawn signature via `<Image src={signature_image}>`, timestamp, IP, and `content_hash` as a verification fingerprint), plus the issuer (business) identity. Generated client-side on demand by either party. ⚠️ react-pdf only renders in a prod build — verify via `npm run preview`, not the dev server.

**Notifications** reuse the bell stream (`contract_signed` → the contract). API: `src/api/publicContract.js` (`getPublicContract`, `signContract`, `declineContract`) + owner helpers on `src/api/contracts.js` (`sendContract`, `regenerateContractLink`, store signing URL) + `src/hooks/useContracts.js` additions. Route `/c/:token`. Impeccable pass on all new UI.

## Testing

- **Unit (vitest):** a pure `canSign(status)` / `signPayload` guard (only `sent` signable; already-signed → current state) and a `contractContentCanonical(contract)` helper (the exact string hashed) — so the hash is deterministic and testable in JS mirroring the SQL.
- **Migration verification (hosted, `begin…rollback`):** insert a ZZ `sent` contract with a token; `get_public_contract` returns curated JSON (no owner-only leakage); `sign_contract` twice (2nd no-op → already); confirm `status='active'`, `signed_at`/`signer_name`/`content_hash` set, one notification; anon can't `select contracts` directly. Roll back — zero residue.
- **Component (vitest):** the public page (renders terms; Sign disabled until name+drawing+consent; signed state shows confirmation), `SignaturePad` (draw → non-empty dataURL; Clear resets), and the contract-detail send/signed panel (Send reveals link; signed panel shows the record). Mock hooks.
- **Certificate PDF:** a smoke test that `buildContractCertificateBlob` returns a Blob for a signed fixture (react-pdf runs headless in vitest for blob generation; visual check via `npm run preview`).
- **E2E (read-only):** owner → a contract → the "Send for signature" control renders. No public signing against live data (covered by the guard unit + component tests).

## Out of scope (v1)

Mutual/counter-signature by the freelancer; hashing the uploaded PDF bytes (v1 hashes the structured terms; the PDF is referenced by `signing_pdf_url`); server-side certificate generation (client-side react-pdf instead); reminder emails; and tier-gating.
