import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

const SELECT =
  'id, project_id, contract_id, task_id, started_at, ended_at, duration_minutes, paused_at, paused_seconds, description, billable, hourly_rate, invoiced_on_invoice_id, projects(name, client_id, clients(name)), contracts(title, hourly_rate)'

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

export async function startTimer({ projectId, contractId = null, description = '', hourlyRate = null }) {
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      user_id: await uid(),
      project_id: projectId,
      contract_id: contractId || null,
      description,
      hourly_rate: hourlyRate,
      started_at: new Date().toISOString(),
      billable: true,
    })
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function pauseTimer(id) {
  const { data, error } = await supabase
    .from('time_entries')
    .update({ paused_at: new Date().toISOString() })
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function resumeTimer(id) {
  const { data: row, error: e1 } = await supabase.from('time_entries').select('paused_at, paused_seconds').eq('id', id).single()
  if (e1) throw mapPostgresError(e1)
  const add = row.paused_at ? Math.round((Date.now() - new Date(row.paused_at).getTime()) / 1000) : 0
  const { data, error } = await supabase
    .from('time_entries')
    .update({ paused_at: null, paused_seconds: (Number(row.paused_seconds) || 0) + add })
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

// Commit: finalize the entry, excluding any paused time from the duration.
export async function stopTimer(id) {
  const { data: row, error: e1 } = await supabase
    .from('time_entries')
    .select('started_at, paused_at, paused_seconds')
    .eq('id', id)
    .single()
  if (e1) throw mapPostgresError(e1)
  const endedMs = Date.now()
  let pausedSeconds = Number(row.paused_seconds) || 0
  if (row.paused_at) pausedSeconds += Math.round((endedMs - new Date(row.paused_at).getTime()) / 1000)
  const activeSec = Math.max(0, (endedMs - new Date(row.started_at).getTime()) / 1000 - pausedSeconds)
  const { data, error } = await supabase
    .from('time_entries')
    .update({
      ended_at: new Date(endedMs).toISOString(),
      duration_minutes: Math.round(activeSec / 60),
      paused_at: null,
      paused_seconds: pausedSeconds,
    })
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function createManualEntry({ projectId, contractId = null, date, durationMinutes, description = '', billable = true, hourlyRate = null }) {
  const startedAt = new Date(`${date}T09:00:00`).toISOString()
  const endedAt = new Date(new Date(startedAt).getTime() + durationMinutes * 60000).toISOString()
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      user_id: await uid(),
      project_id: projectId,
      contract_id: contractId || null,
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
      description,
      billable,
      hourly_rate: hourlyRate,
    })
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

export async function generateInvoiceFromTimeForProject(projectId) {
  const { data, error } = await supabase.rpc('generate_invoice_from_time_for_project', { p_project_id: projectId })
  if (error) throw mapPostgresError(error)
  return data // new invoice id
}
