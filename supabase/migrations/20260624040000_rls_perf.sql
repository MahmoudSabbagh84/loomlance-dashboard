-- Performance: covering indexes for foreign keys + RLS initplan optimization.

-- Covering indexes for FK columns the linter flagged (advisor 0001).
create index if not exists client_contacts_user_idx on public.client_contacts (user_id);
create index if not exists contracts_project_idx on public.contracts (project_id);
create index if not exists error_logs_user_idx on public.error_logs (user_id);
create index if not exists expenses_invoiced_invoice_idx on public.expenses (invoiced_on_invoice_id);
create index if not exists invoice_line_items_user_idx on public.invoice_line_items (user_id);
create index if not exists invoice_payments_user_idx on public.invoice_payments (user_id);
create index if not exists kanban_columns_user_idx on public.kanban_columns (user_id);
create index if not exists project_budget_changes_user_idx on public.project_budget_changes (user_id);
create index if not exists recurring_templates_client_idx on public.recurring_invoice_templates (client_id);
create index if not exists recurring_templates_project_idx on public.recurring_invoice_templates (project_id);
create index if not exists tasks_user_idx on public.tasks (user_id);
create index if not exists time_entries_invoiced_invoice_idx on public.time_entries (invoiced_on_invoice_id);
create index if not exists time_entries_task_idx on public.time_entries (task_id);
create index if not exists usage_events_user_idx on public.usage_events (user_id);

-- RLS initplan (advisor 0003): wrap bare auth.uid() in a scalar subselect so the planner
-- evaluates it once per query instead of once per row. Rewrites every public policy that
-- references it, preserving each policy's exact expression. One-shot (re-running would
-- double-wrap), which is fine for a migration.
do $$
declare
  r record;
  v_using text;
  v_check text;
  stmt text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual ~ 'auth\.uid\(\)' or with_check ~ 'auth\.uid\(\)')
  loop
    v_using := case when r.qual is not null
      then regexp_replace(r.qual, 'auth\.uid\(\)', '(select auth.uid())', 'g') end;
    v_check := case when r.with_check is not null
      then regexp_replace(r.with_check, 'auth\.uid\(\)', '(select auth.uid())', 'g') end;
    stmt := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if v_using is not null then stmt := stmt || format(' using (%s)', v_using); end if;
    if v_check is not null then stmt := stmt || format(' with check (%s)', v_check); end if;
    execute stmt;
  end loop;
end $$;
