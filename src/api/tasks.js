import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listTasks(projectId, { includeArchived = false } = {}) {
  let q = supabase.from('tasks').select('*').eq('project_id', projectId)
  if (!includeArchived) q = q.is('archived_at', null)
  q = q.order('position', { ascending: true })
  const { data, error } = await q
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createTask(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('tasks').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateTask(id, patch) {
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function archiveDoneInColumn(columnId) {
  const { error } = await supabase
    .from('tasks')
    .update({ archived_at: new Date().toISOString() })
    .eq('column_id', columnId)
    .is('archived_at', null)
  if (error) throw mapPostgresError(error)
}

// Compute a new position between two existing positions (or at the end).
export function positionBetween(before, after) {
  if (before == null && after == null) return 1024
  if (before == null) return after - 1024
  if (after == null) return before + 1024
  return (before + after) / 2
}
