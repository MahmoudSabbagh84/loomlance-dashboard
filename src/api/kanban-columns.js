import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listColumns(projectId) {
  const { data, error } = await supabase
    .from('kanban_columns')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createColumn(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('kanban_columns').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateColumn(id, patch) {
  const { data, error } = await supabase.from('kanban_columns').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteColumn(id) {
  const { error } = await supabase.from('kanban_columns').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function reorderColumns(projectId, idsInOrder) {
  // Update positions one by one — projects rarely have many columns.
  for (let i = 0; i < idsInOrder.length; i++) {
    const { error } = await supabase.from('kanban_columns').update({ position: i }).eq('id', idsInOrder[i])
    if (error) throw mapPostgresError(error)
  }
}
