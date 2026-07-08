import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

const COLS =
  'id, user_id, project_id, contract_id, client_id, title, description, currency, amount, hours, hourly_rate, added_days, status, public_token, link_expires_at, sent_at, decided_at, approver_name, decline_reason, billed_invoice_id, created_at, updated_at'

export async function listChangeRequests(projectId) {
  const { data, error } = await supabase
    .from('change_requests')
    .select(COLS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data
}

export async function createChangeRequest(input) {
  const { data: session } = await supabase.auth.getSession()
  const user_id = session?.session?.user?.id
  const { data, error } = await supabase.from('change_requests').insert({ ...input, user_id }).select(COLS).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateChangeRequest(id, patch) {
  const { data, error } = await supabase.from('change_requests').update(patch).eq('id', id).select(COLS).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteChangeRequest(id) {
  const { error } = await supabase.from('change_requests').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function sendChangeRequest(id) {
  const { data, error } = await supabase.rpc('send_change_request', { p_id: id })
  if (error) throw mapPostgresError(error)
  return data // token
}

export async function regenerateChangeRequestLink(id) {
  const { data, error } = await supabase.rpc('regenerate_change_request_link', { p_id: id })
  if (error) throw mapPostgresError(error)
  return data // token
}

// Approved change → a draft invoice with the change as a single line item. The RPC creates the
// invoice, its line item, and stamps billed_invoice_id atomically (guarded: approved + not yet
// billed), so it can't double-bill and the line total always equals the authoritative amount.
// Returns the new invoice id.
export async function billChangeRequest(id) {
  const { data, error } = await supabase.rpc('bill_change_request', { p_id: id })
  if (error) throw mapPostgresError(error)
  return data
}
