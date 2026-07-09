import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

// Curated public view of a contract by token, or null if invalid/expired.
export async function getPublicContract(token) {
  const { data, error } = await supabase.rpc('get_public_contract', { p_token: token })
  if (error) throw mapPostgresError(error)
  return data
}

// Client signs. Idempotent server-side (only a 'sent' contract is signable).
export async function signContract({ token, name, signatureImage, consent }) {
  const { data, error } = await supabase.rpc('sign_contract', {
    p_token: token,
    p_signer_name: name,
    p_signature_image: signatureImage,
    p_consent: consent,
  })
  if (error) throw mapPostgresError(error)
  return data
}

export async function declineContract({ token, reason }) {
  const { data, error } = await supabase.rpc('decline_contract', { p_token: token, p_reason: reason ?? null })
  if (error) throw mapPostgresError(error)
  return data
}
