-- Credential vault: personal, envelope-encrypted secrets. Ciphertext-only at rest; RLS owner-only;
-- NO public surface (unlike invoices/change-requests). All crypto happens in edge functions
-- (vault-store / vault-reveal) using a master key held only in the edge environment.
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
  -- secret, ciphertext only (base64); the auth tag is embedded in the GCM ciphertext:
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
