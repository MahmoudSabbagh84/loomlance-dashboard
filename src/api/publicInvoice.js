import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

// Returns the curated invoice JSON, or null if the token is invalid/expired.
export async function getPublicInvoice(token) {
  const { data, error } = await supabase.rpc('get_public_invoice', { p_token: token })
  if (error) throw mapPostgresError(error)
  return data
}
