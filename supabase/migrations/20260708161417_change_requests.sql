-- Scope-creep change requests (Phase: differentiator). A freelancer raises a structured change
-- request on a project; the client approves/declines it on a hosted /cr/:token page; an approved
-- request is one-click billed into a draft invoice. Mirrors the invoice public-link pattern:
-- owner-only table (RLS), token-gated SECURITY DEFINER RPCs for the public read + write.
create type change_request_status as enum ('draft', 'sent', 'approved', 'declined');

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  description text not null default '',
  currency text not null,
  amount numeric not null default 0,
  hours numeric,
  hourly_rate numeric,
  added_days integer,
  status change_request_status not null default 'draft',
  public_token text unique,
  link_expires_at timestamptz,
  sent_at timestamptz,
  decided_at timestamptz,
  approver_name text,
  decline_reason text,
  billed_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index change_requests_project_idx on public.change_requests (project_id);

alter table public.change_requests enable row level security;
create policy change_requests_owner_all on public.change_requests
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger change_requests_set_updated_at
  before update on public.change_requests
  for each row execute function public.set_updated_at();

-- Owner: issue the public link + mark sent (SECURITY DEFINER with an explicit ownership guard).
create or replace function public.send_change_request(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  update public.change_requests
     set status = case when status = 'draft' then 'sent' else status end,
         sent_at = coalesce(sent_at, now()),
         public_token = coalesce(public_token, replace(gen_random_uuid()::text, '-', ''))
   where id = p_id and user_id = auth.uid()
   returning public_token into v_token;
  return v_token;
end;
$$;

-- Owner: rotate the link (invalidates the old URL).
create or replace function public.regenerate_change_request_link(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  update public.change_requests set public_token = v_token
   where id = p_id and user_id = auth.uid();
  if not found then return null; end if;
  return v_token;
end;
$$;

-- Public read: curated display fields by token; null on missing/expired.
create or replace function public.get_public_change_request(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cr record;
begin
  select r.id, r.title, r.description, r.currency, r.amount, r.hours, r.hourly_rate,
         r.added_days, r.status, r.decided_at, r.approver_name, r.link_expires_at,
         p.business_name, p.logo_url, p.invoice_accent_color, p.invoice_footer,
         c.name as client_name, c.company as client_company
    into cr
    from public.change_requests r
    join public.profiles p on p.id = r.user_id
    left join public.clients c on c.id = r.client_id
   where r.public_token = p_token;

  if not found then return null; end if;
  if cr.link_expires_at is not null and cr.link_expires_at < now() then return null; end if;

  return jsonb_build_object(
    'title', cr.title, 'description', cr.description, 'currency', cr.currency,
    'amount', cr.amount, 'hours', cr.hours, 'hourly_rate', cr.hourly_rate, 'added_days', cr.added_days,
    'status', cr.status, 'already_decided', cr.status in ('approved','declined'),
    'approver_name', cr.approver_name, 'decided_at', cr.decided_at,
    'business_name', cr.business_name, 'logo_url', cr.logo_url,
    'accent_color', cr.invoice_accent_color, 'footer', cr.invoice_footer,
    'client_name', cr.client_name, 'client_company', cr.client_company
  );
end;
$$;

-- Public write: approve/decline. Idempotent — only a 'sent' request is decidable.
create or replace function public.respond_to_change_request(
  p_token text, p_decision text, p_approver_name text default null, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cr record; v_new change_request_status;
begin
  select * into cr from public.change_requests where public_token = p_token;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if cr.link_expires_at is not null and cr.link_expires_at < now() then
    return jsonb_build_object('error', 'not_found');
  end if;
  if cr.status <> 'sent' then
    return jsonb_build_object('status', cr.status, 'already', true);
  end if;
  if p_decision not in ('approve', 'decline') then
    return jsonb_build_object('error', 'bad_decision');
  end if;

  v_new := case when p_decision = 'approve' then 'approved' else 'declined' end::change_request_status;
  update public.change_requests
     set status = v_new, decided_at = now(),
         approver_name = case when p_decision = 'approve' then p_approver_name else approver_name end,
         decline_reason = case when p_decision = 'decline' then p_reason else decline_reason end
   where id = cr.id;

  insert into public.user_notifications (user_id, kind, payload, link_to)
  values (
    cr.user_id,
    case when p_decision = 'approve' then 'change_request_approved' else 'change_request_declined' end,
    jsonb_build_object('title', 'Change request ' || v_new::text,
                       'body', cr.title || (case when p_decision='approve' then ' was approved' else ' was declined' end)),
    '/projects/' || cr.project_id::text
  );

  return jsonb_build_object('status', v_new, 'ok', true);
end;
$$;

grant execute on function public.send_change_request(uuid) to authenticated;
grant execute on function public.regenerate_change_request_link(uuid) to authenticated;
grant execute on function public.get_public_change_request(text) to anon, authenticated;
grant execute on function public.respond_to_change_request(text, text, text, text) to anon, authenticated;
