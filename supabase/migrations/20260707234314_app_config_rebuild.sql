-- app_config v2 (Phase 4): rebuilt after the original (mock_payments_enabled only) was
-- dropped at go-live (20260625130000). Single-row config: world-readable so the login page
-- and app shell can read pre/post-auth; updates gated on public.is_admin() (RLS is the
-- boundary — same pattern as the posts CMS). Changes are audit-logged to usage_events,
-- joining the Phase 3 admin_action stream.
create table public.app_config (
  id boolean primary key default true check (id),
  maintenance_banner text,
  updated_at timestamptz not null default now()
);

insert into public.app_config (id) values (true) on conflict do nothing;

alter table public.app_config enable row level security;

create policy app_config_read_all on public.app_config
  for select to anon, authenticated using (true);

create policy app_config_update_admin on public.app_config
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- no insert/delete policies: the PK check + seed enforce exactly one row.

create trigger app_config_set_updated_at
  before update on public.app_config
  for each row execute function public.set_updated_at();

-- Audit: SECURITY DEFINER so the insert isn't blocked by usage_events RLS. Logs only on
-- actual banner changes; auth.uid() is the acting admin (null if changed via SQL editor).
create or replace function public.log_app_config_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.maintenance_banner is distinct from old.maintenance_banner then
    insert into public.usage_events (user_id, kind, payload)
    values (
      auth.uid(),
      'admin_action',
      jsonb_build_object(
        'action', 'config',
        'field', 'maintenance_banner',
        'from', old.maintenance_banner,
        'to', new.maintenance_banner,
        'at', now()
      )
    );
  end if;
  return new;
end;
$$;

create trigger app_config_audit
  after update on public.app_config
  for each row execute function public.log_app_config_change();
