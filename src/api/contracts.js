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
