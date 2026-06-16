import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listContacts(clientId) {
  const { data, error } = await supabase
    .from('client_contacts')
    .select('*')
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createContact(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('client_contacts').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateContact(id, patch) {
  const { data, error } = await supabase.from('client_contacts').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteContact(id) {
  const { error } = await supabase.from('client_contacts').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function setPrimary(contactId, clientId) {
  // Unset other primaries first, then set this one. Done as two ops to keep RLS simple.
  const { error: e1 } = await supabase
    .from('client_contacts')
    .update({ is_primary: false })
    .eq('client_id', clientId)
    .eq('is_primary', true)
  if (e1) throw mapPostgresError(e1)
  const { data, error: e2 } = await supabase
    .from('client_contacts')
    .update({ is_primary: true })
    .eq('id', contactId)
    .select()
    .single()
  if (e2) throw mapPostgresError(e2)
  return data
}
