-- profiles: one row per auth user, written on signup via trigger
create type subscription_tier as enum ('free', 'tier_1', 'tier_2');
create type subscription_status as enum ('active', 'past_due', 'canceled', 'incomplete', 'trialing');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  business_name text,
  email text not null,
  default_currency text not null default 'USD',
  tax_id text,
  address text,
  logo_url text,
  invoice_accent_color text default '#2D3E50',
  invoice_footer text,
  stripe_connect_account_id text,
  subscription_tier subscription_tier not null default 'free',
  subscription_status subscription_status not null default 'active',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT or DELETE policies: profiles are managed by the trigger and webhook only.
-- subscription_tier and subscription_status are writeable by service_role only (no policy = denied for auth.uid()).
