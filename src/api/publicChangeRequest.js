import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

// Curated public view of a change request by token, or null if invalid/expired.
export async function getPublicChangeRequest(token) {
  const { data, error } = await supabase.rpc('get_public_change_request', { p_token: token })
  if (error) throw mapPostgresError(error)
  return data
}

// Client approve/decline. Idempotent server-side (only a 'sent' request is decidable).
export async function respondToChangeRequest({ token, decision, approverName, reason }) {
  const { data, error } = await supabase.rpc('respond_to_change_request', {
    p_token: token,
    p_decision: decision,
    p_approver_name: approverName ?? null,
    p_reason: reason ?? null,
  })
  if (error) throw mapPostgresError(error)
  return data
}
