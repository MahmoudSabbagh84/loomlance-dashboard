import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { invokeEdge } from '@/api/edge'

// Metadata only — never the ciphertext columns (useless client-side; keeps payloads lean).
const META_COLS = 'id, project_id, label, type, username, url, notes, last_accessed_at, created_at'

export async function listVaultCredentials() {
  const { data, error } = await supabase
    .from('vault_credentials')
    .select(META_COLS)
    .order('created_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data
}

// Create, or update WITH a new secret — routes through the edge function (only it can encrypt).
export async function saveVaultCredentialWithSecret(input) {
  return invokeEdge('vault-store', input) // { id?, label, type, username, url, notes, project_id, secret } -> { id }
}

// Metadata-only edit — no secret change, so it goes straight through the RLS'd table.
export async function updateVaultMetadata(id, patch) {
  const { error } = await supabase.from('vault_credentials').update(patch).eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function deleteVaultCredential(id) {
  const { error } = await supabase.from('vault_credentials').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function revealVaultSecret(id) {
  const { value } = await invokeEdge('vault-reveal', { id })
  return value
}
