# Task Keys & Refs — Implementation Plan (Plan 1 of GitHub Integration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every project a user-set 2–5 char **task key** and number every task per-project so tasks have Jira-style refs like `LLM-001`, displayed on the board.

**Architecture:** A DB migration adds `projects.task_key` (unique per user) + `projects.last_task_number` + `tasks.ref_number`, with a `BEFORE INSERT` trigger that atomically assigns the next per-project number; existing rows are backfilled. The React layer adds a "Task key" field to project creation (auto-suggested from the name) and renders the ref on the kanban card and task drawer via a pure `taskRef()` helper.

**Tech Stack:** Supabase Postgres (migrations via Supabase MCP `apply_migration`), React + Vite, react-hook-form + Zod, TanStack Query, Vitest, Tailwind (Slate Pro tokens).

**Why this is Plan 1:** It's independently valuable (refs are useful on their own) and is a hard prerequisite for Plan 2's smart-commit completion (`KEY-### done` in a commit). See `docs/superpowers/specs/2026-06-28-github-issue-sync-design.md`.

## Global Constraints

- **DB is hosted Supabase** project `zbipqfsqxnvrzhpdjvvy` — apply migrations with the Supabase MCP `apply_migration` tool **and** save the identical SQL to a local file under `supabase/migrations/`. No local Docker.
- **Task key format:** 2–5 chars, uppercase, must start with a letter, then letters/digits — regex `^[A-Z][A-Z0-9]{1,4}$`. Unique per user.
- **Display ref format:** `task_key + '-' + ref_number zero-padded to ≥3 digits` → `LLM-001`, `LLM-1000`.
- **Ref numbering is per-project, sequential, starting at 1**, assigned by the DB (never the client).
- **Voice/UI:** calm, plain, developer-first; all UI changes follow the Slate Pro design system and the Impeccable skill guidance. Body text ≥4.5:1 contrast.
- **Commits:** end every commit message with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT push (the user pushes manually).
- **Test runner:** `npm run test:run` (Vitest). Lint: `npm run lint`. Build: `npm run build`.

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/20260629000000_task_keys_and_refs.sql` | Schema: task_key, ref_number, numbering trigger, backfill | Create |
| `src/lib/taskRef.js` | Pure helpers: `taskRef(key, num)`, `suggestTaskKey(name)` | Create |
| `src/lib/__tests__/taskRef.test.js` | Unit tests for the helpers | Create |
| `src/api/schemas/projects.js` | Add `task_key` to `projectCreateSchema` | Modify |
| `src/lib/errors.js` | Map the `task_key` unique violation → `TASK_KEY_TAKEN` | Modify |
| `src/lib/__tests__/errors.test.js` | Test the new error mapping | Modify |
| `src/features/projects/ProjectFormModal.jsx` | "Task key" field + auto-suggest from name | Modify |
| `src/features/kanban/TaskCard.jsx` | Render `KEY-001` ref on the card | Modify |
| `src/features/kanban/KanbanColumn.jsx` | Thread `taskKey` prop to cards | Modify |
| `src/features/kanban/KanbanBoard.jsx` | Load project, thread `taskKey` down | Modify |
| `src/features/kanban/TaskDrawer.jsx` | Show ref in the drawer title | Modify |

---

### Task 1: Migration — task keys, ref numbers, numbering trigger, backfill

**Files:**
- Create: `supabase/migrations/20260629000000_task_keys_and_refs.sql`

**Interfaces:**
- Produces: `projects.task_key text NOT NULL` (unique per user), `projects.last_task_number int`, `tasks.ref_number int` (auto-assigned on insert), trigger `tasks_assign_ref`, function `public.assign_task_ref()`. Unique constraint name: `projects_user_id_task_key_key`. Format check: `projects_task_key_format`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260629000000_task_keys_and_refs.sql` with exactly:

```sql
-- Per-project task keys + sequential task ref numbers (e.g. LLM-001).

-- 1. New columns (task_key nullable until backfilled).
alter table public.projects
  add column task_key text,
  add column last_task_number integer not null default 0;

alter table public.tasks
  add column ref_number integer;

-- 2. Backfill a unique-per-user task_key for every existing project.
do $$
declare
  p record;
  base text;
  candidate text;
  n int;
begin
  for p in select id, user_id, name from public.projects order by created_at loop
    base := upper(regexp_replace(coalesce(p.name, ''), '[^a-zA-Z0-9]', '', 'g'));
    if base !~ '^[A-Za-z]' then base := 'P' || base; end if;
    if length(base) < 2 then base := 'PRJ'; end if;
    base := left(base, 5);
    candidate := base;
    n := 1;
    while exists (
      select 1 from public.projects
      where user_id = p.user_id and task_key = candidate
    ) loop
      n := n + 1;
      candidate := left(base, greatest(1, 5 - length(n::text))) || n::text;
    end loop;
    update public.projects set task_key = candidate where id = p.id;
  end loop;
end $$;

-- 3. Backfill ref_number per project (sequential by creation), and last_task_number.
with numbered as (
  select id,
         row_number() over (partition by project_id order by created_at, id) as rn
  from public.tasks
)
update public.tasks t
set ref_number = numbered.rn
from numbered
where numbered.id = t.id;

update public.projects p
set last_task_number = coalesce(
  (select max(ref_number) from public.tasks where project_id = p.id), 0
);

-- 4. Lock down task_key now that data exists.
alter table public.projects
  alter column task_key set not null,
  add constraint projects_user_id_task_key_key unique (user_id, task_key),
  add constraint projects_task_key_format check (task_key ~ '^[A-Z][A-Z0-9]{1,4}$');

-- 5. Assign ref_number on every future task insert (atomic per project).
create or replace function public.assign_task_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ref_number is null then
    update public.projects
      set last_task_number = last_task_number + 1
      where id = new.project_id
      returning last_task_number into new.ref_number;
  end if;
  return new;
end;
$$;

create trigger tasks_assign_ref
  before insert on public.tasks
  for each row execute function public.assign_task_ref();
```

- [ ] **Step 2: Apply the migration to the hosted DB**

Use the Supabase MCP `apply_migration` tool with `name: "task_keys_and_refs"` and the SQL body from Step 1.
Expected: success, no error.

- [ ] **Step 3: Verify existing data was backfilled**

Use the Supabase MCP `execute_sql` tool:

```sql
select count(*) as projects_without_key from public.projects where task_key is null;
select count(*) as tasks_without_ref from public.tasks where ref_number is null;
select id, name, task_key, last_task_number from public.projects order by created_at limit 5;
```
Expected: `projects_without_key = 0`, `tasks_without_ref = 0`, every project row has a non-null `task_key` matching `^[A-Z][A-Z0-9]{1,4}$`, and `last_task_number` equals that project's task count.

- [ ] **Step 4: Verify the trigger assigns the next number on insert**

Use `execute_sql` (uses the existing demo project `b0000000-0000-4000-8000-000000000001`; if it has no columns, pick any project id + one of its column ids from the verify query):

```sql
-- record current counter
select last_task_number from public.projects where id = 'b0000000-0000-4000-8000-000000000001';
-- insert a probe task into that project's first column
insert into public.tasks (user_id, project_id, column_id, title)
select user_id, 'b0000000-0000-4000-8000-000000000001',
       (select id from public.kanban_columns where project_id = 'b0000000-0000-4000-8000-000000000001' order by position limit 1),
       'ZZ ref-probe'
from public.projects where id = 'b0000000-0000-4000-8000-000000000001'
returning ref_number;
-- the returned ref_number must equal previous last_task_number + 1; clean up:
delete from public.tasks where title = 'ZZ ref-probe' and project_id = 'b0000000-0000-4000-8000-000000000001';
```
Expected: the `returning ref_number` is exactly the previous `last_task_number + 1`. (The delete leaves the counter advanced — that's correct; numbers are not reused.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260629000000_task_keys_and_refs.sql
git commit -m "feat(db): per-project task keys + sequential task ref numbers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `taskRef` + `suggestTaskKey` pure helpers

**Files:**
- Create: `src/lib/taskRef.js`
- Test: `src/lib/__tests__/taskRef.test.js`

**Interfaces:**
- Produces: `taskRef(taskKey: string, refNumber: number|null) => string` (e.g. `'LLM-001'`, `''` when either is missing); `suggestTaskKey(name: string) => string` (2–5 uppercase chars, starts with a letter).

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/taskRef.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { taskRef, suggestTaskKey } from '@/lib/taskRef'

describe('taskRef', () => {
  it('pads the number to at least 3 digits', () => {
    expect(taskRef('LLM', 1)).toBe('LLM-001')
    expect(taskRef('API', 42)).toBe('API-042')
    expect(taskRef('ABCDE', 1234)).toBe('ABCDE-1234')
  })
  it('returns empty string when key or number is missing', () => {
    expect(taskRef('', 1)).toBe('')
    expect(taskRef('LLM', null)).toBe('')
    expect(taskRef('LLM', undefined)).toBe('')
  })
})

describe('suggestTaskKey', () => {
  it('uses initials for multi-word names', () => {
    expect(suggestTaskKey('LoomLance Mobile')).toBe('LM')
    expect(suggestTaskKey('My Cool Project App X')).toBe('MCPAX')
  })
  it('uses the first letters for a single word', () => {
    expect(suggestTaskKey('Loomlance')).toBe('LOOM')
  })
  it('uppercases and strips punctuation', () => {
    expect(suggestTaskKey('acme-corp')).toBe('AC')
  })
  it('falls back to PRJ when empty', () => {
    expect(suggestTaskKey('')).toBe('PRJ')
    expect(suggestTaskKey('   ')).toBe('PRJ')
  })
  it('always starts with a letter', () => {
    expect(suggestTaskKey('123 build')).toMatch(/^[A-Z]/)
  })
  it('never exceeds 5 characters', () => {
    expect(suggestTaskKey('one two three four five six').length).toBeLessThanOrEqual(5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/lib/__tests__/taskRef.test.js`
Expected: FAIL — cannot resolve `@/lib/taskRef` (module does not exist).

- [ ] **Step 3: Write the implementation**

Create `src/lib/taskRef.js`:

```js
// Format a task's human-facing reference, e.g. taskRef('LLM', 1) => 'LLM-001'.
// Returns '' when the key or number is missing (e.g. before the migration backfilled them).
export function taskRef(taskKey, refNumber) {
  if (!taskKey || refNumber == null) return ''
  return `${taskKey}-${String(refNumber).padStart(3, '0')}`
}

// Suggest a 2–5 char uppercase task key from a project name. Starts with a letter.
// Multi-word names -> initials; single word -> first 4 chars; empty -> 'PRJ'.
export function suggestTaskKey(name) {
  const cleaned = String(name || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim()
  if (!cleaned) return 'PRJ'
  const words = cleaned.split(/\s+/).filter(Boolean)
  let key = words.length >= 2 ? words.map((w) => w[0]).join('') : words[0].slice(0, 4)
  key = key.replace(/[^A-Z0-9]/g, '')
  if (!/^[A-Z]/.test(key)) key = 'P' + key
  if (key.length < 2) key = (words[0] + 'XX').slice(0, 3)
  return key.slice(0, 5)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/lib/__tests__/taskRef.test.js`
Expected: PASS (all 8 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/taskRef.js src/lib/__tests__/taskRef.test.js
git commit -m "feat(tasks): taskRef + suggestTaskKey helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Zod schema + `TASK_KEY_TAKEN` error mapping

**Files:**
- Modify: `src/api/schemas/projects.js`
- Modify: `src/lib/errors.js`
- Test: `src/lib/__tests__/errors.test.js`

**Interfaces:**
- Consumes: `mapPostgresError(error)` returns an `AppError` with `.code` and `.userMessage` (existing).
- Produces: `projectCreateSchema` now includes `task_key`; `mapPostgresError` returns code `TASK_KEY_TAKEN` for the `projects_user_id_task_key_key` unique violation.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/__tests__/errors.test.js` (mirror the existing `INVOICE_NUMBER_TAKEN` test — keep the existing imports):

```js
it('maps the task_key unique violation to TASK_KEY_TAKEN', () => {
  const err = mapPostgresError({
    code: '23505',
    message: 'duplicate key value violates unique constraint "projects_user_id_task_key_key"',
  })
  expect(err.code).toBe('TASK_KEY_TAKEN')
  expect(err.userMessage.toLowerCase()).toContain('task key')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/lib/__tests__/errors.test.js`
Expected: FAIL — `err.code` is the generic fallback (e.g. `UNIQUE_VIOLATION`/`UNKNOWN`), not `TASK_KEY_TAKEN`.

- [ ] **Step 3: Implement the error mapping**

In `src/lib/errors.js`, add a `TASK_KEY_TAKEN` entry to the `CODE_MESSAGES` map (next to `INVOICE_NUMBER_TAKEN`):

```js
  TASK_KEY_TAKEN: 'That task key is already used by another project. Pick a different one.',
```

And in `detectCode`, inside the `23505` branch (next to the `invoices_user_id_invoice_number_key` check), add:

```js
    if (m.includes('projects_user_id_task_key_key')) return 'TASK_KEY_TAKEN'
```

- [ ] **Step 4: Add `task_key` to the project create schema**

In `src/api/schemas/projects.js`, add a `task_key` field to `projectCreateSchema` (after `color`):

```js
  task_key: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9]{1,4}$/, '2–5 letters or numbers, starting with a letter')
    .transform((s) => s.toUpperCase()),
```

(`projectUpdateSchema` extends `projectCreateSchema.partial()`, so it inherits `task_key` as optional automatically — no change needed there.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- src/lib/__tests__/errors.test.js`
Expected: PASS (new + existing error tests).

- [ ] **Step 6: Commit**

```bash
git add src/api/schemas/projects.js src/lib/errors.js src/lib/__tests__/errors.test.js
git commit -m "feat(projects): task_key in schema + TASK_KEY_TAKEN error

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: "Task key" field in project creation (auto-suggested)

**Files:**
- Modify: `src/features/projects/ProjectFormModal.jsx`

**Interfaces:**
- Consumes: `suggestTaskKey(name)` from `@/lib/taskRef`; `projectCreateSchema` (now requires `task_key`); `create.mutateAsync(values)` (existing — `values` now carries `task_key`, which flows straight into the `projects` insert).
- Produces: project creation collects a valid `task_key`.

**Context:** The modal uses `react-hook-form` with `zodResolver(projectCreateSchema)`, `defaultValues { client_id, name, description, color }`, and renders fields in order client_id → name → description → color. Add the field between **name** and **description**. Only the create path needs the suggestion (edit mode autosaves existing values).

**Prerequisite check (the migration made `task_key` NOT NULL):** before implementing, run `grep -rn "createProject" src` and confirm `ProjectFormModal` is the only caller that inserts a project. If any other caller exists (e.g. a "duplicate"/template/onboarding path), it must also supply a `task_key` (use `suggestTaskKey(name)`), or its inserts will fail the NOT NULL constraint. Report any such caller before proceeding.

- [ ] **Step 1: Add the import and form wiring**

In `src/features/projects/ProjectFormModal.jsx`:

1. Add to imports:
```js
import { useEffect, useState } from 'react'
import { suggestTaskKey } from '@/lib/taskRef'
```
(Merge `useEffect`/`useState` into the existing React import if one exists; otherwise add it. Ensure `Label` and `FieldError` are imported from `@/components/ui/Label` and `@/components/ui/FieldError` — add them if missing.)

2. Add `task_key: ''` to the `useForm` `defaultValues` object.

3. Destructure `watch` and `setValue` from `useForm` (add them to the existing destructure list).

4. After the `useForm(...)` call, add the auto-suggest effect:
```js
  const [keyEdited, setKeyEdited] = useState(false)
  const nameValue = watch('name')
  useEffect(() => {
    if (!isEdit && !keyEdited) {
      setValue('task_key', suggestTaskKey(nameValue), { shouldValidate: false })
    }
  }, [nameValue, keyEdited, isEdit, setValue])
```
(`isEdit` already exists in this component — it gates autosave. Reuse it.)

- [ ] **Step 2: Add the field JSX**

Insert this block between the `name` field block and the `description` field block:

```jsx
          <div>
            <Label htmlFor="task_key">Task key</Label>
            <Input
              id="task_key"
              maxLength={5}
              placeholder="LLM"
              className="uppercase"
              {...register('task_key', {
                onChange: (e) => {
                  setKeyEdited(true)
                  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
                },
              })}
            />
            <p className="mt-1 text-xs text-fg-muted">
              Used for task refs like {watch('task_key') || 'KEY'}-001. 2–5 letters or numbers.
            </p>
            <FieldError>{errors.task_key?.message}</FieldError>
          </div>
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint`
Expected: no errors.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open the app, click "New project":
- The "Task key" field shows a suggestion derived from the name (type a name → key updates until you edit the key field).
- Editing the key stops the auto-suggestion; lowercase input renders uppercase; non-alphanumerics are stripped; capped at 5 chars.
- Create the project. Then confirm it persisted with the Supabase MCP `execute_sql`:
```sql
select name, task_key from public.projects order by created_at desc limit 1;
```
Expected: the new project's `task_key` matches what you entered (uppercased).
- Run the e2e to confirm project creation still works (the field auto-fills, so the existing flow stays green):
`npm run test:e2e` (or the project's Playwright command) — expected: happy-path passes.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/ProjectFormModal.jsx
git commit -m "feat(projects): task key field with auto-suggest in create modal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Display `KEY-001` on the board card and task drawer

**Files:**
- Modify: `src/features/kanban/KanbanBoard.jsx`
- Modify: `src/features/kanban/KanbanColumn.jsx`
- Modify: `src/features/kanban/TaskCard.jsx`
- Modify: `src/features/kanban/TaskDrawer.jsx`

**Interfaces:**
- Consumes: `taskRef(taskKey, refNumber)` from `@/lib/taskRef`; `useProject(projectId)` from `@/hooks/useProjects` (returns the project incl. `task_key`); `task.ref_number` (present after Task 1).
- Produces: the ref renders on each card and in the drawer title.

**Note:** The tasks list query (`src/api/tasks.js` `listTasks`) and project query must include the new columns. If they use `select('*')`, nothing to change. If `listTasks` selects an explicit column list, add `ref_number` to it; if the project query selects an explicit list, add `task_key`. Check before implementing.

- [ ] **Step 1: Thread `taskKey` from the board**

In `src/features/kanban/KanbanBoard.jsx`:

1. Add import:
```js
import { useProject } from '@/hooks/useProjects'
```
2. Inside `KanbanBoard`, after the existing hooks, add:
```js
  const { data: project } = useProject(projectId)
  const taskKey = project?.task_key
```
3. Pass `taskKey` to the column (line that renders `<KanbanColumn ... />`):
```jsx
                <KanbanColumn column={col} tasks={filteredTasksByColumn.get(col.id) || []} onTaskClick={onTaskClick} taskKey={taskKey} />
```
4. Pass `taskKey` to the drag-overlay card:
```jsx
        <DragOverlay>{activeTask ? <TaskCard task={activeTask} taskKey={taskKey} asOverlay /> : null}</DragOverlay>
```

- [ ] **Step 2: Pass `taskKey` through the column**

In `src/features/kanban/KanbanColumn.jsx`, accept and forward `taskKey`:

```jsx
export function KanbanColumn({ column, tasks, onTaskClick, taskKey }) {
```
and in the task map:
```jsx
        {tasks.map((t) => <TaskCard key={t.id} task={t} taskKey={taskKey} onClick={() => onTaskClick?.(t)} />)}
```

- [ ] **Step 3: Render the ref on the card**

In `src/features/kanban/TaskCard.jsx`:

1. Add import:
```js
import { taskRef } from '@/lib/taskRef'
```
2. Update the signature:
```js
export function TaskCard({ task, taskKey, onClick, asOverlay = false }) {
```
3. Add the ref line immediately above the title `<p>` (line 26):
```jsx
      {taskKey && task.ref_number != null ? (
        <p className="mb-1 font-mono text-xs text-fg-muted">{taskRef(taskKey, task.ref_number)}</p>
      ) : null}
      <p className="font-medium leading-snug">{task.title}</p>
```

- [ ] **Step 4: Show the ref in the drawer title**

In `src/features/kanban/TaskDrawer.jsx`:

1. Add imports:
```js
import { useProject } from '@/hooks/useProjects'
import { taskRef } from '@/lib/taskRef'
```
2. Inside `TaskDrawer`, after `const update = useUpdateTask(projectId)`, add:
```js
  const { data: project } = useProject(projectId)
```
3. Change the `Drawer` title from `title="Task"` to:
```jsx
      <Drawer open={open} onClose={onClose} title={taskRef(project?.task_key, task?.ref_number) || 'Task'}>
```

- [ ] **Step 5: Verify lint + build**

Run: `npm run lint`
Expected: no errors.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open a project board:
- Each task card shows its ref (e.g. `LLM-001`) above the title, in muted mono text.
- Opening a task drawer shows the ref as the drawer title.
- Adding a new task via the inline add gives it the next ref number (reopen the card to confirm).

- [ ] **Step 7: Commit**

```bash
git add src/features/kanban/KanbanBoard.jsx src/features/kanban/KanbanColumn.jsx src/features/kanban/TaskCard.jsx src/features/kanban/TaskDrawer.jsx
git commit -m "feat(kanban): show task refs (KEY-001) on cards and drawer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- Every project has a unique-per-user `task_key`; every task has a per-project sequential `ref_number` (backfilled + auto-assigned on insert).
- Project creation collects a valid, auto-suggested task key.
- Task cards and the task drawer display `KEY-001`-style refs.
- `npm run lint`, `npm run test:run`, and `npm run build` all pass.

This unblocks Plan 2 (GitHub integration), where a commit message `KEY-### done` resolves a task by its ref.
