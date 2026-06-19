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
    .insert({
      user_id: await uid(),
      project_id: projectId,
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
    .insert({
      user_id: await uid(),
      project_id: projectId,
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

export async function generateInvoiceFromTime(clientId) {
  const { data, error } = await supabase.rpc('generate_invoice_from_time', { p_client_id: clientId })
  if (error) throw mapPostgresError(error)
  return data // new invoice id
}
