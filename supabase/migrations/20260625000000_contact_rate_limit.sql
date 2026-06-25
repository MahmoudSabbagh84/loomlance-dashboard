-- Rate-limit the PUBLIC contact-form Edge Function (no JWT → no per-user throttle available).
-- Bounds inbox spam and SES send-quota/cost abuse from a single source. Per-IP sliding window.

create table if not exists public.contact_rate_limit (
  id uuid primary key default extensions.gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists contact_rate_limit_ip_time on public.contact_rate_limit (ip, created_at);

-- RLS on, NO policies → end users (anon/authenticated) can't read or write it. Only the
-- SECURITY DEFINER RPC below (and service_role) touch it.
alter table public.contact_rate_limit enable row level security;

-- Atomic check-and-record: prune stale rows, count this IP's hits in the window, record the
-- attempt, and return whether the caller is still under the cap. Window 10 min, max 5 hits.
-- Returns TRUE when the request is allowed (i.e. it was under the cap BEFORE this attempt).
create or replace function public.check_contact_rate_limit(p_ip text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window constant interval := interval '10 minutes';
  v_max    constant integer  := 5;
  v_count  integer;
begin
  if p_ip is null or p_ip = '' then
    -- Can't identify the source → don't hard-block, but don't record either.
    return true;
  end if;

  -- Opportunistic prune so the table can't grow unbounded.
  delete from public.contact_rate_limit where created_at < now() - interval '1 day';

  select count(*) into v_count
  from public.contact_rate_limit
  where ip = p_ip and created_at > now() - v_window;

  insert into public.contact_rate_limit (ip) values (p_ip);

  return v_count < v_max;
end;
$$;

-- Service-role only (the contact-form function calls with the service-role key). Never expose
-- this on the REST RPC surface to anon/authenticated.
revoke execute on function public.check_contact_rate_limit(text) from anon, authenticated, public;
grant execute on function public.check_contact_rate_limit(text) to service_role;
