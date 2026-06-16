import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listProjects({ clientId, status = 'all', search = '' } = {}) {
  let q = supabase.from('projects').select('*, clients(name)')
  if (clientId) q = q.eq('client_id', clientId)
  if (status === 'active') q = q.eq('status', 'active').is('archived_at', null)
  if (status === 'archived') q = q.not('archived_at', 'is', null)
  if (status === 'paused') q = q.eq('status', 'paused')
  if (search) q = q.ilike('name', `%${search}%`)
  q = q.order('updated_at', { ascending: false })
  const { data, error } = await q
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function getProject(id) {
  const { data, error } = await supabase.from('projects').select('*, clients(name)').eq('id', id).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function countActiveProjects() {
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .is('archived_at', null)
  if (error) throw mapPostgresError(error)
  return count || 0
}

export async function createProject(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('projects').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateProject(id, patch) {
  const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function archiveProject(id) {
  return updateProject(id, { status: 'archived', archived_at: new Date().toISOString() })
}

export async function unarchiveProject(id) {
  return updateProject(id, { status: 'active', archived_at: null })
}

export async function deleteProject(id) {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}
