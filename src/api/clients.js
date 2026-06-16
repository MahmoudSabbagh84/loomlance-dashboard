import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listClients({ search = '', sort = { field: 'name', dir: 'asc' }, page = 0, pageSize = 25, includeArchived = false } = {}) {
  let q = supabase.from('clients').select('*', { count: 'exact' })
  if (!includeArchived) q = q.is('archived_at', null)
  if (search) q = q.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`)
  q = q.order(sort.field, { ascending: sort.dir === 'asc' })
  q = q.range(page * pageSize, page * pageSize + pageSize - 1)
  const { data, error, count } = await q
  if (error) throw mapPostgresError(error)
  return { rows: data || [], total: count || 0 }
}

export async function getClient(id) {
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function createClient(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('clients').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateClient(id, patch) {
  const { data, error } = await supabase.from('clients').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function archiveClient(id) {
  return updateClient(id, { archived_at: new Date().toISOString() })
}

export async function unarchiveClient(id) {
  return updateClient(id, { archived_at: null })
}

export async function deleteClient(id) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}
