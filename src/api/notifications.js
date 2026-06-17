import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listNotifications({ unreadOnly = false, limit = 20 } = {}) {
  let q = supabase.from('user_notifications').select('*').order('created_at', { ascending: false }).limit(limit)
  if (unreadOnly) q = q.is('read_at', null)
  const { data, error } = await q
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function unreadCount() {
  const { count, error } = await supabase
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw mapPostgresError(error)
  return count || 0
}

export async function markRead(id) {
  const { error } = await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function markAllRead() {
  const { error } = await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (error) throw mapPostgresError(error)
}
