import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

// Returns the curated invoice JSON, or null if the token is invalid/expired.
export async function getPublicInvoice(token) {
  const { data, error } = await supabase.rpc('get_public_invoice', { p_token: token })
  if (error) throw mapPostgresError(error)
  return data
}

export async function mockPayInvoice(token) {
  const { data, error } = await supabase.rpc('mock_pay_invoice', { p_token: token })
  if (error) throw mapPostgresError(error)
  return data
}
