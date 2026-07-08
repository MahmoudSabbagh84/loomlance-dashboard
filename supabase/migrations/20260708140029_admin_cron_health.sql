-- admin_cron_health(): per-job pg_cron status for the admin Ops page (Phase 6).
-- SECURITY DEFINER because the cron schema is not exposed to API roles; EXECUTE locked to
-- service_role (called only by the admin-ops edge function behind the admin gate).
create or replace function public.admin_cron_health()
returns table (
  jobname text,
  schedule text,
  last_run_at timestamptz,
  last_status text,
  last_message text,
  failures_7d bigint
)
language sql
security definer
set search_path = public
as $$
  select
    j.jobname::text,
    j.schedule::text,
    d.start_time,
    d.status::text,
    d.return_message::text,
    (select count(*) from cron.job_run_details f
      where f.jobid = j.jobid and f.status = 'failed'
        and f.start_time >= now() - interval '7 days') as failures_7d
  from cron.job j
  left join lateral (
    select start_time, status, return_message
    from cron.job_run_details r
    where r.jobid = j.jobid
    order by start_time desc
    limit 1
  ) d on true
  order by j.jobname;
$$;

revoke all on function public.admin_cron_health() from public;
revoke all on function public.admin_cron_health() from anon;
revoke all on function public.admin_cron_health() from authenticated;
grant execute on function public.admin_cron_health() to service_role;
