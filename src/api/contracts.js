import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listContracts({ clientId, status, search = '', sort = { field: 'created_at', dir: 'desc' }, page = 0, pageSize = 25 } = {}) {
  let q = supabase.from('contracts').select('*, clients(name), projects(name)', { count: 'exact' })
  if (clientId) q = q.eq('client_id', clientId)
  if (status) q = q.eq('status', status)
  if (search) q = q.ilike('title', `%${search}%`)
  q = q.order(sort.field, { ascending: sort.dir === 'asc' })
  q = q.range(page * pageSize, page * pageSize + pageSize - 1)
  const { data, error, count } = await q
  if (error) throw mapPostgresError(error)
  return { rows: data || [], total: count || 0 }
}

// Contracts a time entry can be tagged to: same client, the entry's project or
// no project, and active/draft only. Used by the timer + entry form pickers.
export async function listTaggableContracts({ projectId, clientId } = {}) {
  if (!projectId || !clientId) return []
  const { data, error } = await supabase
    .from('contracts')
    .select('id, title, hourly_rate')
    .eq('client_id', clientId)
    .in('status', ['active', 'draft'])
    .or(`project_id.eq.${projectId},project_id.is.null`)
    .order('title')
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function getContract(id) {
  const { data, error } = await supabase.from('contracts').select('*, clients(name), projects(name)').eq('id', id).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function createContract(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('contracts').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateContract(id, patch) {
  const { data, error } = await supabase.from('contracts').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteContract(id) {
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function uploadContractPdf(contractId, file) {
  const path = `${contractId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
  const { error: upErr } = await supabase.storage.from('contract-pdfs').upload(path, file, { upsert: false })
  if (upErr) throw mapPostgresError(upErr)
  return updateContract(contractId, { pdf_storage_path: path })
}

export async function getSignedPdfUrl(path) {
  const { data, error } = await supabase.storage.from('contract-pdfs').createSignedUrl(path, 60 * 60)
  if (error) throw mapPostgresError(error)
  return data.signedUrl
}

// A long-expiry (~30-day) signed URL for the contract PDF, so the public signing page can show it.
export async function signedPdfUrlForSigning(path) {
  const { data, error } = await supabase.storage.from('contract-pdfs').createSignedUrl(path, 60 * 60 * 24 * 30)
  if (error) throw mapPostgresError(error)
  return data.signedUrl
}

export async function sendContract(id) {
  const { data, error } = await supabase.rpc('send_contract', { p_id: id })
  if (error) throw mapPostgresError(error)
  return data // token
}

export async function regenerateContractLink(id) {
  const { data, error } = await supabase.rpc('regenerate_contract_link', { p_id: id })
  if (error) throw mapPostgresError(error)
  return data // token
}

async function storeSigningUrl(id, url) {
  const { error } = await supabase.from('contracts').update({ signing_pdf_url: url }).eq('id', id)
  if (error) throw mapPostgresError(error)
}

// Orchestrates the Send action: issue the token, then (if a PDF exists) store its long-lived signed URL.
export async function sendContractForSignature(contract) {
  const token = await sendContract(contract.id)
  if (contract.pdf_storage_path) {
    const url = await signedPdfUrlForSigning(contract.pdf_storage_path)
    await storeSigningUrl(contract.id, url)
  }
  return token
}
