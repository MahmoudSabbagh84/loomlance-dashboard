# Phase 4 — Time Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tier 1+ time tracking — a DB-backed topbar timer, manual entries on a `/time` page, and an atomic "generate invoice from unbilled time" grouped by project + rate.

**Architecture:** A `time_entries` table (project-bound; `ended_at is null` = running, enforced single by a partial unique index) + a `generate_invoice_from_time` RPC do the server side. The SPA follows the existing `api/* → hooks/*` split; pure time math lives in `lib/time.js` (unit-tested). The topbar timer reads the running entry from the DB so it survives reload.

**Tech Stack:** Supabase Postgres + RPC, supabase-js, TanStack Query, react-hook-form, the existing `useProjects`/`useClients`/`useUpdateProfile`, `TierGate`/`UpgradeCard`, Vitest, Playwright.

**Conventions:** Apply migrations via MCP `apply_migration` → `list_migrations` → write `supabase/migrations/<version>_<name>.sql` to match → commit. Lint is a hard gate (`npx eslint . --max-warnings 0` exits 0). Test user `test@loomlance.com`/`password123` is tier_2 and in active use — clean up only its own seeded entries/invoice. **Storage gotcha N/A here.** Spec: `docs/superpowers/specs/2026-06-18-loomlance-phase-4-time-tracking-design.md`.

---

### Task 1: Database — table, profile rate, RPC, error codes

**Files:**
- Create: `supabase/migrations/<version>_time_tracking.sql`
- Modify: `src/lib/errors.js`

- [ ] **Step 1: Apply via MCP `apply_migration` (name: `time_tracking`)**

```sql
alter table public.profiles add column if not exists default_hourly_rate numeric(10,2);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes int,
  description text,
  billable boolean not null default true,
  hourly_rate numeric(10,2),
  invoiced_on_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index time_entries_user_started_idx on public.time_entries (user_id, started_at desc);
create index time_entries_project_idx on public.time_entries (project_id);
-- At most one running timer per user.
create unique index time_entries_one_running on public.time_entries (user_id) where ended_at is null;

create trigger time_entries_set_updated_at before update on public.time_entries
  for each row execute function public.set_updated_at();

alter table public.time_entries enable row level security;
create policy "time_entries_select_own" on public.time_entries for select using (user_id = auth.uid());
create policy "time_entries_insert_own" on public.time_entries for insert with check (user_id = auth.uid());
create policy "time_entries_update_own" on public.time_entries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "time_entries_delete_own" on public.time_entries for delete using (user_id = auth.uid());

-- Atomic: group unbilled billable time for a client by (project, rate) into a draft invoice.
create or replace function public.generate_invoice_from_time(p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invoice_id uuid;
  v_number text;
  v_currency text;
  v_count int;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.time_entries te
  join public.projects p on p.id = te.project_id
  where te.user_id = v_user and te.billable and te.invoiced_on_invoice_id is null
    and te.ended_at is not null and p.client_id = p_client_id and p.user_id = v_user;
  if v_count = 0 then
    raise exception 'NO_UNBILLED_TIME' using errcode = 'P0001';
  end if;

  select default_currency into v_currency from public.profiles where id = v_user;
  v_number := public.next_invoice_number(v_user);

  insert into public.invoices (user_id, client_id, invoice_number, status, currency, issue_date, due_date)
  values (v_user, p_client_id, v_number, 'draft', coalesce(v_currency, 'USD'), current_date, current_date + 30)
  returning id into v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, description, quantity, unit_price, tax_rate, discount_rate, position)
  select
    v_user, v_invoice_id,
    p.name || ' — time',
    round(sum(te.duration_minutes)::numeric / 60, 2),
    coalesce(te.hourly_rate, 0),
    0, 0,
    (row_number() over (order by p.name, te.hourly_rate)) - 1
  from public.time_entries te
  join public.projects p on p.id = te.project_id
  where te.user_id = v_user and te.billable and te.invoiced_on_invoice_id is null
    and te.ended_at is not null and p.client_id = p_client_id and p.user_id = v_user
  group by p.id, p.name, te.hourly_rate;

  update public.time_entries te
  set invoiced_on_invoice_id = v_invoice_id
  from public.projects p
  where te.project_id = p.id and te.user_id = v_user and te.billable
    and te.invoiced_on_invoice_id is null and te.ended_at is not null
    and p.client_id = p_client_id and p.user_id = v_user;

  return v_invoice_id;
end;
$$;
revoke all on function public.generate_invoice_from_time(uuid) from public, anon;
grant execute on function public.generate_invoice_from_time(uuid) to authenticated;
```

- [ ] **Step 2: Mirror locally.** MCP `list_migrations` → write the identical SQL to `supabase/migrations/<version>_time_tracking.sql`.

- [ ] **Step 3: Error codes.** Edit `src/lib/errors.js` — add to `CODE_MESSAGES`:

```js
  NO_UNBILLED_TIME: 'No unbilled time for this client.',
  TIMER_ALREADY_RUNNING: 'A timer is already running. Stop it first.',
```

And in `detectCode`, extend the `23505` block to map the running-timer index:

```js
  if (supabaseError.code === '23505') {
    const m = supabaseError.message || ''
    if (m.includes('invoices_user_id_invoice_number_key')) return 'INVOICE_NUMBER_TAKEN'
    if (m.includes('time_entries_one_running')) return 'TIMER_ALREADY_RUNNING'
  }
```

- [ ] **Step 4: Functional test via MCP `execute_sql` (self-cleaning).** Seed for the test user: ensure a project exists (use "Site Building" or seed one), insert 2 completed billable time_entries on it (e.g. 90 min @ $100 and 30 min @ $100), then:

```sql
-- run the generator for that project's client
select public.generate_invoice_from_time((select client_id from projects where name='Site Building' limit 1)) as invoice_id;
-- assert: a draft invoice exists with one line item qty 2.00 (120 min @ $100), and the 2 entries now have invoiced_on_invoice_id set.
```

Then delete the seeded entries + the generated invoice (markers: the entries' description `ZZ time test`).

- [ ] **Step 5: Gate + commit.** `npx eslint . --max-warnings 0`. `git add supabase/migrations/<version>_time_tracking.sql src/lib/errors.js docs/superpowers/plans/2026-06-18-loomlance-phase-4-time-tracking.md docs/superpowers/specs/2026-06-18-loomlance-phase-4-time-tracking-design.md && git commit -m "feat(time): time_entries table, default rate, generate-invoice-from-time RPC"`.

---

### Task 2: Time math helpers + unit tests

**Files:**
- Create: `src/lib/time.js`
- Create: `src/lib/__tests__/time.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/time.test.js`

```js
import { describe, it, expect } from 'vitest'
import { computeDurationMinutes, hoursFromMinutes, formatDuration, formatElapsed, groupTimeForInvoice } from '@/lib/time'

describe('computeDurationMinutes', () => {
  it('rounds ms to minutes', () => {
    expect(computeDurationMinutes('2026-01-01T09:00:00Z', '2026-01-01T10:30:00Z')).toBe(90)
  })
  it('never negative', () => {
    expect(computeDurationMinutes('2026-01-01T10:00:00Z', '2026-01-01T09:00:00Z')).toBe(0)
  })
})

describe('hoursFromMinutes', () => {
  it('2 decimals', () => expect(hoursFromMinutes(90)).toBe(1.5))
})

describe('formatDuration', () => {
  it('h+m', () => expect(formatDuration(90)).toBe('1h 30m'))
  it('h only', () => expect(formatDuration(120)).toBe('2h'))
  it('m only', () => expect(formatDuration(45)).toBe('45m'))
})

describe('formatElapsed', () => {
  it('H:MM:SS', () => expect(formatElapsed(3661)).toBe('1:01:01'))
})

describe('groupTimeForInvoice', () => {
  it('groups by project + rate and sums', () => {
    const rows = [
      { project_id: 'a', hourly_rate: 100, duration_minutes: 90, projects: { name: 'Web' } },
      { project_id: 'a', hourly_rate: 100, duration_minutes: 30, projects: { name: 'Web' } },
      { project_id: 'a', hourly_rate: 140, duration_minutes: 60, projects: { name: 'Web' } },
    ]
    const g = groupTimeForInvoice(rows)
    expect(g).toHaveLength(2)
    const at100 = g.find((x) => x.rate === 100)
    expect(at100.hours).toBe(2)
    expect(at100.amount).toBe(200)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/time.test.js` → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/time.js`**

```js
export function computeDurationMinutes(startedAt, endedAt) {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  return Math.max(0, Math.round(ms / 60000))
}

export function hoursFromMinutes(minutes) {
  return Math.round(((minutes || 0) / 60) * 100) / 100
}

export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes || 0))
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h && mm) return `${h}h ${mm}m`
  if (h) return `${h}h`
  return `${mm}m`
}

export function formatElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function groupTimeForInvoice(entries) {
  const groups = new Map()
  for (const e of entries || []) {
    const rate = Number(e.hourly_rate) || 0
    const key = `${e.project_id}|${rate}`
    const g = groups.get(key) || { projectId: e.project_id, projectName: e.projects?.name || 'Project', rate, minutes: 0 }
    g.minutes += Number(e.duration_minutes) || 0
    groups.set(key, g)
  }
  return [...groups.values()].map((g) => {
    const hours = hoursFromMinutes(g.minutes)
    return { ...g, hours, amount: Math.round(hours * g.rate * 100) / 100 }
  })
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/__tests__/time.test.js` → PASS.
- [ ] **Step 5: Commit.** Gate lint. `git add src/lib/time.js src/lib/__tests__/time.test.js && git commit -m "feat(time): time math + invoice-grouping helpers + tests"`.

---

### Task 3: API + hooks

**Files:**
- Create: `src/api/time-entries.js`
- Create: `src/hooks/useTimeEntries.js`

- [ ] **Step 1: `src/api/time-entries.js`**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { computeDurationMinutes } from '@/lib/time'

const SELECT =
  'id, project_id, task_id, started_at, ended_at, duration_minutes, description, billable, hourly_rate, invoiced_on_invoice_id, projects(name, client_id, clients(name))'

async function uid() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.user?.id
}

export async function listTimeEntries({ projectId, from, to, status = 'all' } = {}) {
  let q = supabase.from('time_entries').select(SELECT).order('started_at', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  if (from) q = q.gte('started_at', from)
  if (to) q = q.lte('started_at', to)
  if (status === 'unbilled') q = q.is('invoiced_on_invoice_id', null)
  if (status === 'billed') q = q.not('invoiced_on_invoice_id', 'is', null)
  const { data, error } = await q
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function getRunningTimer() {
  const { data, error } = await supabase.from('time_entries').select(SELECT).is('ended_at', null).maybeSingle()
  if (error) throw mapPostgresError(error)
  return data
}

export async function startTimer({ projectId, description = '', hourlyRate = null }) {
  const { data, error } = await supabase
    .from('time_entries')
    .insert({ user_id: await uid(), project_id: projectId, description, hourly_rate: hourlyRate, started_at: new Date().toISOString(), billable: true })
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function stopTimer(id) {
  const { data: row, error: e1 } = await supabase.from('time_entries').select('started_at').eq('id', id).single()
  if (e1) throw mapPostgresError(e1)
  const endedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('time_entries')
    .update({ ended_at: endedAt, duration_minutes: computeDurationMinutes(row.started_at, endedAt) })
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function createManualEntry({ projectId, date, durationMinutes, description = '', billable = true, hourlyRate = null }) {
  const startedAt = new Date(`${date}T09:00:00`).toISOString()
  const endedAt = new Date(new Date(startedAt).getTime() + durationMinutes * 60000).toISOString()
  const { data, error } = await supabase
    .from('time_entries')
    .insert({ user_id: await uid(), project_id: projectId, started_at: startedAt, ended_at: endedAt, duration_minutes: durationMinutes, description, billable, hourly_rate: hourlyRate })
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateEntry(id, patch) {
  const { data, error } = await supabase.from('time_entries').update(patch).eq('id', id).select(SELECT).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('time_entries').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function generateInvoiceFromTime(clientId) {
  const { data, error } = await supabase.rpc('generate_invoice_from_time', { p_client_id: clientId })
  if (error) throw mapPostgresError(error)
  return data // new invoice id
}
```

- [ ] **Step 2: `src/hooks/useTimeEntries.js`**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/time-entries'

export function useTimeEntries(filters) {
  return useQuery({ queryKey: ['time-entries', filters], queryFn: () => api.listTimeEntries(filters) })
}
export function useRunningTimer() {
  return useQuery({ queryKey: ['time-entries', 'running'], queryFn: api.getRunningTimer, refetchInterval: 30_000 })
}
function useInvalidateTime() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['time-entries'] })
}
export function useStartTimer() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: api.startTimer, onSuccess: inv })
}
export function useStopTimer() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: api.stopTimer, onSuccess: inv })
}
export function useCreateManualEntry() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: api.createManualEntry, onSuccess: inv })
}
export function useUpdateEntry() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: ({ id, patch }) => api.updateEntry(id, patch), onSuccess: inv })
}
export function useDeleteEntry() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: api.deleteEntry, onSuccess: inv })
}
export function useGenerateInvoiceFromTime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.generateInvoiceFromTime,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
```

- [ ] **Step 3: Gate + commit.** `npm run build`, lint. `git add src/api/time-entries.js src/hooks/useTimeEntries.js && git commit -m "feat(time): time-entries api + hooks"`.

---

### Task 4: Topbar timer widget

**Files:**
- Create: `src/features/time/TimerWidget.jsx`
- Modify: `src/components/layout/Topbar.jsx`

- [ ] **Step 1: `TimerWidget.jsx`** — Tier 1+ only; idle → start popover (project select); running → live elapsed + Stop.

```jsx
import { useState, useEffect, useRef } from 'react'
import { Play, Square, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/components/ui/cn'
import { useProfile } from '@/hooks/useProfile'
import { useProjects } from '@/hooks/useProjects'
import { hasFeature, FEATURES } from '@/lib/tier'
import { formatElapsed } from '@/lib/time'
import { useRunningTimer, useStartTimer, useStopTimer } from '@/hooks/useTimeEntries'

export function TimerWidget() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const { data: running } = useRunningTimer()
  const start = useStartTimer()
  const stop = useStopTimer()
  const { data: projects = [] } = useProjects({ status: 'active' })
  const [open, setOpen] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    if (!running) return
    const tick = () => setElapsed((Date.now() - new Date(running.started_at).getTime()) / 1000)
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [running])

  if (!hasFeature(tier, FEATURES.TIME_TRACKING)) return null

  const onStart = async () => {
    if (!projectId) return
    try {
      await start.mutateAsync({ projectId, hourlyRate: profile?.default_hourly_rate ?? null })
      setOpen(false); setProjectId('')
    } catch (e) { toast.error(e.userMessage || 'Could not start timer') }
  }
  const onStop = async () => {
    try { await stop.mutateAsync(running.id); toast.success('Timer stopped') }
    catch (e) { toast.error(e.userMessage || 'Could not stop timer') }
  }

  if (running) {
    return (
      <button onClick={onStop} className="flex h-9 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15">
        <span className="tabular-nums">{formatElapsed(elapsed)}</span>
        <Square className="size-3.5 fill-current" />
      </button>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-label="Start timer" className="grid size-9 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg">
        <Clock className="size-5" />
      </button>
      {open ? (
        <div className="animate-pop-in absolute right-0 mt-2 w-64 rounded-lg border border-border bg-bg-elevated p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium text-fg-muted">Start a timer</p>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mb-2 h-9 w-full rounded-md border border-border bg-bg-muted px-2 text-sm">
            <option value="">Select a project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={onStart} disabled={!projectId || start.isPending} className={cn('flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-fg', (!projectId || start.isPending) && 'opacity-50')}>
            <Play className="size-4" /> Start
          </button>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Mount in `Topbar.jsx`** — import `TimerWidget`; render it as the first child of the right-controls `div` (the one containing `<NotificationBell/>`): `<TimerWidget />` before `<NotificationBell />`.

- [ ] **Step 3: Gate + commit.** `npm run build`, lint. `git add src/features/time/TimerWidget.jsx src/components/layout/Topbar.jsx && git commit -m "feat(time): topbar start/stop timer"`.

---

### Task 5: /time page — entries table + manual entry + filters + default rate

**Files:**
- Create: `src/features/time/TimeEntryFormModal.jsx`
- Create: `src/features/time/TimeEntriesTable.jsx`
- Create: `src/pages/TimePage.jsx`
- Modify: `src/app/routes.jsx`

- [ ] **Step 1: `TimeEntryFormModal.jsx`** — create/edit a manual entry.

```jsx
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useProjects } from '@/hooks/useProjects'
import { useProfile } from '@/hooks/useProfile'
import { useCreateManualEntry, useUpdateEntry } from '@/hooks/useTimeEntries'

export function TimeEntryFormModal({ open, onClose, entry }) {
  const { data: projects = [] } = useProjects({ status: 'all' })
  const { data: profile } = useProfile()
  const create = useCreateManualEntry()
  const update = useUpdateEntry()
  const isEdit = !!entry
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      project_id: entry?.project_id ?? '',
      date: (entry?.started_at ?? new Date().toISOString()).slice(0, 10),
      hours: entry ? Math.floor((entry.duration_minutes ?? 0) / 60) : 0,
      minutes: entry ? (entry.duration_minutes ?? 0) % 60 : 0,
      description: entry?.description ?? '',
      billable: entry?.billable ?? true,
      hourly_rate: entry?.hourly_rate ?? profile?.default_hourly_rate ?? '',
    },
  })

  const onSubmit = async (v) => {
    const durationMinutes = Number(v.hours) * 60 + Number(v.minutes)
    if (durationMinutes <= 0) { toast.error('Enter a duration'); return }
    const payload = {
      projectId: v.project_id, date: v.date, durationMinutes, description: v.description,
      billable: v.billable, hourlyRate: v.hourly_rate === '' ? null : Number(v.hourly_rate),
    }
    try {
      if (isEdit) {
        await update.mutateAsync({ id: entry.id, patch: { project_id: v.project_id, description: v.description, billable: v.billable, hourly_rate: payload.hourlyRate, duration_minutes: durationMinutes } })
      } else {
        await create.mutateAsync(payload)
      }
      toast.success(isEdit ? 'Entry updated' : 'Time logged')
      onClose()
    } catch (e) { toast.error(e.userMessage || 'Could not save') }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit entry' : 'Log time'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div><Label htmlFor="project_id" required>Project</Label>
          <Select id="project_id" {...register('project_id', { required: true })}>
            <option value="">Select…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label htmlFor="date">Date</Label><Input id="date" type="date" {...register('date')} /></div>
          <div><Label htmlFor="hours">Hours</Label><Input id="hours" type="number" min="0" {...register('hours')} /></div>
          <div><Label htmlFor="minutes">Minutes</Label><Input id="minutes" type="number" min="0" max="59" {...register('minutes')} /></div>
        </div>
        <div><Label htmlFor="description">Description</Label><Textarea id="description" rows={2} {...register('description')} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="hourly_rate">Hourly rate</Label><Input id="hourly_rate" type="number" step="0.01" {...register('hourly_rate')} /></div>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" {...register('billable')} /> Billable</label>
        </div>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Log time'}</Button></div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: `TimeEntriesTable.jsx`**

```jsx
import { Pencil, Trash2 } from 'lucide-react'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/date'
import { formatDuration } from '@/lib/time'
import { formatCurrency } from '@/lib/currency'

export function TimeEntriesTable({ entries, currency = 'USD', onEdit, onDelete }) {
  return (
    <Table>
      <THead><TR><TH>Date</TH><TH>Project</TH><TH>Description</TH><TH>Duration</TH><TH>Rate</TH><TH>Status</TH><TH></TH></TR></THead>
      <tbody>
        {entries.map((e) => (
          <TR key={e.id}>
            <TD className="text-xs tabular-nums text-fg-muted">{formatDate(e.started_at)}</TD>
            <TD>{e.projects?.name}</TD>
            <TD className="text-fg-muted">{e.description || '—'}</TD>
            <TD className="tabular-nums">{e.ended_at ? formatDuration(e.duration_minutes) : <span className="text-primary">running…</span>}</TD>
            <TD className="tabular-nums">{e.hourly_rate != null ? formatCurrency(Number(e.hourly_rate), currency) : '—'}</TD>
            <TD>{!e.billable ? <Badge>non-billable</Badge> : e.invoiced_on_invoice_id ? <Badge variant="success">billed</Badge> : <Badge variant="info">unbilled</Badge>}</TD>
            <TD>
              <div className="flex justify-end gap-1">
                <button onClick={() => onEdit(e)} className="text-fg-subtle hover:text-fg"><Pencil className="size-4" /></button>
                <button onClick={() => onDelete(e)} className="text-fg-subtle hover:text-danger"><Trash2 className="size-4" /></button>
              </div>
            </TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}
```

- [ ] **Step 3: `TimePage.jsx`** — tier gate, default-rate field, filters, table, Log time + Generate invoice buttons.

```jsx
import { useState } from 'react'
import { Plus, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toolbar } from '@/components/ui/Toolbar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useProjects } from '@/hooks/useProjects'
import { hasFeature, FEATURES } from '@/lib/tier'
import { formatDuration } from '@/lib/time'
import { useTimeEntries, useDeleteEntry } from '@/hooks/useTimeEntries'
import { TimeEntriesTable } from '@/features/time/TimeEntriesTable'
import { TimeEntryFormModal } from '@/features/time/TimeEntryFormModal'
import { GenerateInvoiceModal } from '@/features/time/GenerateInvoiceModal'

export default function TimePage() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const { data: projects = [] } = useProjects({ status: 'all' })
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [genOpen, setGenOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const del = useDeleteEntry()
  const { data: entries = [], isLoading } = useTimeEntries({ projectId: projectId || undefined, status })

  if (!hasFeature(tier, FEATURES.TIME_TRACKING)) {
    return <div className="space-y-5"><PageHeader title="Time" /><UpgradeCard feature={FEATURES.TIME_TRACKING} currentTier={tier} target="tier_1" /></div>
  }

  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader title="Time" subtitle="Track hours and bill them">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setGenOpen(true)}><FileText className="size-4" /> Generate invoice</Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="size-4" /> Log time</Button>
        </div>
      </PageHeader>

      <Toolbar>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-44"><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36"><option value="all">All</option><option value="unbilled">Unbilled</option><option value="billed">Billed</option></Select>
        <label className="ml-auto flex items-center gap-2 text-xs text-fg-muted">Default rate
          <Input type="number" step="0.01" defaultValue={profile?.default_hourly_rate ?? ''} className="h-8 w-24"
            onBlur={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (profile?.default_hourly_rate ?? null)) update.mutate({ default_hourly_rate: v }) }} />
        </label>
      </Toolbar>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : entries.length === 0 ? (
        <EmptyState icon={FileText} title="No time logged" description="Start the timer in the top bar or log time manually." action={<Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> Log time</Button>} />
      ) : (
        <>
          <TimeEntriesTable entries={entries} currency={profile?.default_currency || 'USD'} onEdit={(e) => { setEditing(e); setFormOpen(true) }} onDelete={setToDelete} />
          <p className="text-right text-sm text-fg-muted">Total: <span className="font-medium tabular-nums text-fg">{formatDuration(totalMinutes)}</span></p>
        </>
      )}

      {formOpen ? <TimeEntryFormModal open onClose={() => setFormOpen(false)} entry={editing} /> : null}
      {genOpen ? <GenerateInvoiceModal open onClose={() => setGenOpen(false)} /> : null}
      <ConfirmDialog open={!!toDelete} title="Delete time entry?" body="This cannot be undone." confirmLabel="Delete" variant="danger" loading={del.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => { try { await del.mutateAsync(toDelete.id); toast.success('Deleted'); setToDelete(null) } catch (e) { toast.error(e.userMessage) } }} />
    </div>
  )
}
```

- [ ] **Step 4: Route.** Edit `src/app/routes.jsx` — import `TimePage`; add `{ path: 'time', element: <TimePage /> }` to the protected children.

- [ ] **Step 5: Gate + commit** (after Task 6 supplies `GenerateInvoiceModal`; if implementing Task 5 first, temporarily stub the import). Recommended: do Task 6 before building, then run `npm run build`, lint. `git add src/features/time/TimeEntryFormModal.jsx src/features/time/TimeEntriesTable.jsx src/pages/TimePage.jsx src/app/routes.jsx && git commit -m "feat(time): /time page with entries, manual logging, filters, default rate"`.

---

### Task 6: Generate-invoice-from-time modal

**Files:**
- Create: `src/features/time/GenerateInvoiceModal.jsx`

- [ ] **Step 1: `GenerateInvoiceModal.jsx`** — pick a client, preview grouped lines, generate.

```jsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { useClients } from '@/hooks/useClients'
import { useProfile } from '@/hooks/useProfile'
import { useTimeEntries, useGenerateInvoiceFromTime } from '@/hooks/useTimeEntries'
import { groupTimeForInvoice } from '@/lib/time'
import { formatCurrency } from '@/lib/currency'

export function GenerateInvoiceModal({ open, onClose }) {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const [clientId, setClientId] = useState('')
  const gen = useGenerateInvoiceFromTime()
  const currency = profile?.default_currency || 'USD'
  // unbilled completed billable entries; filter to the chosen client client-side for the preview
  const { data: entries = [] } = useTimeEntries({ status: 'unbilled' })
  const groups = useMemo(() => {
    const forClient = entries.filter((e) => e.ended_at && e.billable && e.projects?.client_id === clientId)
    return groupTimeForInvoice(forClient)
  }, [entries, clientId])

  const onGenerate = async () => {
    try {
      const id = await gen.mutateAsync(clientId)
      toast.success('Draft invoice created')
      onClose()
      navigate(`/invoices/${id}`)
    } catch (e) { toast.error(e.userMessage || 'Could not generate invoice') }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate invoice from time" size="md">
      <div className="space-y-4">
        <div><Label htmlFor="client">Client</Label>
          <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        {clientId ? (
          groups.length ? (
            <div className="rounded-md border border-border">
              {groups.map((g) => (
                <div key={`${g.projectId}-${g.rate}`} className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-0">
                  <span>{g.projectName} · {g.hours}h @ {formatCurrency(g.rate, currency)}</span>
                  <span className="tabular-nums">{formatCurrency(g.amount, currency)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-fg-muted">No unbilled time for this client.</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onGenerate} disabled={!clientId || groups.length === 0} loading={gen.isPending}>Create draft invoice</Button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Gate + commit.** `npm run build`, `npx eslint . --max-warnings 0`, `npx vitest run`. `git add src/features/time/GenerateInvoiceModal.jsx && git commit -m "feat(time): generate-invoice-from-time modal"`.

---

### Task 7: Live verification + wrap

- [ ] **Step 1: Build + preview** (`npm run build`; dev :5173 is fine — no react-pdf here).
- [ ] **Step 2: Playwright (tier-2 test user):**
  1. Login → topbar Clock icon → pick "Site Building" → Start → the widget shows ticking elapsed.
  2. Wait ~3s → click the running widget (Stop) → toast; go to `/time` → an entry with a small duration + "unbilled" badge.
  3. **Log time** manually: project, 1h 30m, rate 100 → saved; total updates.
  4. Set **Default rate** field → reload `/time` → persisted (`profiles.default_hourly_rate`).
  5. **Generate invoice** → pick the project's client → preview shows grouped lines → Create → lands on the draft invoice with the time line items; back on `/time` the entries now show "billed".
  Expected: all pass, 0 page errors.
- [ ] **Step 3: Clean up** — delete the test user's seeded `time_entries` + the generated invoice (by `ZZ`/the generated invoice number); clear `default_hourly_rate`.
- [ ] **Step 4: Memory** — update `loomlance_phase4_progress.md` (sub-project 2 of 5 done; remaining: expenses, recurring, reports).

---

## Self-review

**Spec coverage:** §3 table/index/rate → Task 1. §4 duration math → Task 2. §5.1 api/hooks → Task 3. §5.2 topbar timer → Task 4. §5.3 /time page → Task 5. §5.4 routing/tier → Task 5 Step 4 + page gate. §6 RPC → Task 1. §7 errors → Task 1 Step 3. §8 testing → Tasks 2 (unit) + 7 (Playwright). Covered.

**Type/name consistency:** API fns (`startTimer`, `stopTimer`, `getRunningTimer`, `createManualEntry`, `updateEntry`, `deleteEntry`, `generateInvoiceFromTime`) match hooks and components. `lib/time.js` exports (`computeDurationMinutes`, `hoursFromMinutes`, `formatDuration`, `formatElapsed`, `groupTimeForInvoice`) match usage in Tasks 3–6. RPC name `generate_invoice_from_time(p_client_id)` matches the api call. `FEATURES.TIME_TRACKING` + `UPGRADE_COPY` exist.

**Build-order note:** Task 5's `TimePage` imports `GenerateInvoiceModal` (Task 6). Implement Task 6 before building/committing Task 5, or both before the first build.
