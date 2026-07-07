-- admin_user_stats(): aggregate-only stats over auth.users for the admin Business Pulse.
-- SECURITY DEFINER because auth.users is not readable by app roles; execution is locked to
-- service_role (the admin-metrics edge function) so no browser client can ever call it.
-- Returns counts only — no emails, ids, or any per-user rows. Weeks are ISO (Monday, UTC).
create or replace function public.admin_user_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total',     (select count(*) from auth.users),
    'active7d',  (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days'),
    'active30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    'signupsByWeek', (
      select coalesce(
        jsonb_agg(jsonb_build_object('weekStart', to_char(w.week_start, 'YYYY-MM-DD'), 'count', coalesce(c.n, 0))
                  order by w.week_start),
        '[]'::jsonb)
      from (
        select generate_series(
          (date_trunc('week', now() at time zone 'utc') - interval '11 weeks')::date,
          date_trunc('week', now() at time zone 'utc')::date,
          interval '1 week'
        )::date as week_start
      ) w
      left join (
        select date_trunc('week', created_at at time zone 'utc')::date as week_start, count(*) as n
        from auth.users
        group by 1
      ) c using (week_start)
    )
  );
$$;

revoke all on function public.admin_user_stats() from public;
revoke all on function public.admin_user_stats() from anon;
revoke all on function public.admin_user_stats() from authenticated;
grant execute on function public.admin_user_stats() to service_role;
