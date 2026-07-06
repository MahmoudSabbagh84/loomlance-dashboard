-- Admin-only reset of the demo account (demo@loomlance.com): wipes every row owned by
-- the demo user and re-seeds a canonical fixture so the owner can reset the account
-- after screencast sessions without touching any other user's data.
create or replace function public.reset_demo_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_client_globex uuid;
  v_client_initech uuid;
  v_project_site uuid;
  v_project_tools uuid;
  v_col_todo uuid;
  v_col_progress uuid;
  v_col_review uuid;
  v_col_done uuid;
  v_invoice_1001 uuid;
  v_invoice_1002 uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select id into v_uid from auth.users where email = 'demo@loomlance.com';
  if v_uid is null then
    raise exception 'demo user not found';
  end if;

  -- Wipe (children before parents; every table filtered by the demo user id)
  delete from public.github_issue_cards        where user_id = v_uid;
  delete from public.project_repos             where user_id = v_uid;
  delete from public.github_installations      where user_id = v_uid;
  delete from public.user_notifications        where user_id = v_uid;
  delete from public.usage_events              where user_id = v_uid;
  delete from public.error_logs                where user_id = v_uid;
  delete from public.invoice_payments          where user_id = v_uid;
  delete from public.invoice_line_items        where user_id = v_uid;
  delete from public.invoices                  where user_id = v_uid;
  delete from public.recurring_invoice_templates where user_id = v_uid;
  delete from public.time_entries              where user_id = v_uid;
  delete from public.expenses                  where user_id = v_uid;
  delete from public.project_budget_changes    where user_id = v_uid;
  delete from public.tasks                     where user_id = v_uid;
  delete from public.kanban_columns            where user_id = v_uid;
  delete from public.contracts                 where user_id = v_uid;
  delete from public.projects                  where user_id = v_uid;
  delete from public.client_contacts           where user_id = v_uid;
  delete from public.clients                   where user_id = v_uid;
  delete from public.invoice_number_sequences  where user_id = v_uid;

  -- Re-seed canonical screencast fixture
  -- (Client emails and invoice->client attribution are invented fixture data, not load-bearing.)
  -- Clients: "Globex Digital" <billing@globex.example>, "Initech Labs" <accounts@initech.example>
  insert into public.clients (user_id, name, email)
  values (v_uid, 'Globex Digital', 'billing@globex.example')
  returning id into v_client_globex;

  insert into public.clients (user_id, name, email)
  values (v_uid, 'Initech Labs', 'accounts@initech.example')
  returning id into v_client_initech;

  -- Projects: "Marketing Site Rebuild" (Globex, active), "Internal Tools" (Initech, active)
  -- task_key is not-null/format-checked (projects_and_kanban + task_keys_and_refs migrations)
  -- and has no default; kanban columns are auto-seeded by the seed_default_columns trigger.
  insert into public.projects (user_id, client_id, name, status, task_key)
  values (v_uid, v_client_globex, 'Marketing Site Rebuild', 'active', 'MSR')
  returning id into v_project_site;

  insert into public.projects (user_id, client_id, name, status, task_key)
  values (v_uid, v_client_initech, 'Internal Tools', 'active', 'IT')
  returning id into v_project_tools;

  select id into v_col_todo     from public.kanban_columns where project_id = v_project_site and name = 'To Do';
  select id into v_col_progress from public.kanban_columns where project_id = v_project_site and name = 'In Progress';
  select id into v_col_review   from public.kanban_columns where project_id = v_project_site and name = 'Review';
  select id into v_col_done     from public.kanban_columns where project_id = v_project_site and name = 'Done';

  -- 4 tasks on "Marketing Site Rebuild", spread across its columns:
  --   'Design homepage hero' (To Do), 'Implement pricing page' (In Progress),
  --   'Set up CI' (Review), 'Kickoff call notes' (Done)
  insert into public.tasks (user_id, project_id, column_id, title)
  values
    (v_uid, v_project_site, v_col_todo,     'Design homepage hero'),
    (v_uid, v_project_site, v_col_progress, 'Implement pricing page'),
    (v_uid, v_project_site, v_col_review,   'Set up CI'),
    (v_uid, v_project_site, v_col_done,     'Kickoff call notes');

  -- Invoice sequence: next number 1003 (next_invoice_number increments last_number then formats)
  insert into public.invoice_number_sequences (user_id, last_number)
  values (v_uid, 1002);

  -- Invoices: INV-1001 paid, total $4,800 (2 line items: 'Design sprint' 24h x $100, 'Build sprint' 24h x $100);
  --           INV-1002 sent, total $2,250 (1 line item: 'API integration' 15h x $150), due 14 days out
  insert into public.invoices (user_id, client_id, project_id, invoice_number, issue_date, due_date, status, sent_at, paid_at)
  values (v_uid, v_client_globex, v_project_site, 'INV-1001', current_date - 20, current_date - 6, 'paid', now() - interval '20 days', now() - interval '5 days')
  returning id into v_invoice_1001;

  insert into public.invoices (user_id, client_id, project_id, invoice_number, issue_date, due_date, status, sent_at)
  values (v_uid, v_client_initech, v_project_tools, 'INV-1002', current_date, current_date + 14, 'sent', now())
  returning id into v_invoice_1002;

  insert into public.invoice_line_items (user_id, invoice_id, position, description, quantity, unit_price)
  values
    (v_uid, v_invoice_1001, 0, 'Design sprint', 24, 100.00),
    (v_uid, v_invoice_1001, 1, 'Build sprint', 24, 100.00);

  insert into public.invoice_line_items (user_id, invoice_id, position, description, quantity, unit_price)
  values
    (v_uid, v_invoice_1002, 0, 'API integration', 15, 150.00);

  -- Payment record for INV-1001: every path to 'paid' writes an invoice_payments row
  -- (see mock_pay_invoice in 20260618163016_send_and_pay.sql) so the payment history
  -- renders in the UI. Same column list; 'bank' is a plausible manual method
  -- (payment_method enum: stripe/bank/cash/other/manual); paid_at matches the invoice.
  insert into public.invoice_payments (user_id, invoice_id, amount, currency, paid_at, method)
  values (v_uid, v_invoice_1001, 4800.00, 'USD', now() - interval '5 days', 'bank');

  -- 3 time entries on "Marketing Site Rebuild" (2h, 3.5h, 1.25h, recent dates), 2 expenses
  -- ('Plugin license' $49.00 non-billable, 'Stock photos' $32.00 billable, on the Globex project)
  insert into public.time_entries (user_id, project_id, started_at, ended_at, duration_minutes, description, billable, hourly_rate)
  values
    (v_uid, v_project_site, now() - interval '2 days', now() - interval '2 days' + interval '2 hours', 120, 'Homepage hero design', true, 100.00),
    (v_uid, v_project_site, now() - interval '1 day', now() - interval '1 day' + interval '3.5 hours', 210, 'Pricing page implementation', true, 100.00),
    (v_uid, v_project_site, now() - interval '3 hours', now() - interval '1 hour 45 minutes', 75, 'CI setup', true, 100.00);

  insert into public.expenses (user_id, project_id, client_id, spent_on, amount, currency, category, description, billable)
  values
    (v_uid, v_project_site, v_client_globex, current_date - 3, 49.00, 'USD', 'Software', 'Plugin license', false),
    (v_uid, v_project_site, v_client_globex, current_date - 1, 32.00, 'USD', 'Assets', 'Stock photos', true);
end;
$$;

revoke execute on function public.reset_demo_user() from public, anon;
grant execute on function public.reset_demo_user() to authenticated;
