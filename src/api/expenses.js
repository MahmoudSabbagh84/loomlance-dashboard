import { supabase } from '@/lib/supabase'
import { AppError, mapPostgresError } from '@/lib/errors'
import { validateReceiptFile } from '@/lib/expenses'

const BUCKET = 'receipts'
const SELECT =
  'id, project_id, client_id, spent_on, amount, currency, category, description, receipt_path, billable, invoiced_on_invoice_id, projects(name, client_id, clients(name)), clients(name)'

async function uid() {
  const { data } = await supabase.auth.getSession()
  const id = data?.session?.user?.id
  if (!id) throw new AppError('UNAUTHORIZED', 'You must be signed in.')
  return id
}

export async function listExpenses({ projectId, clientId, category, from, to, status = 'all' } = {}) {
  let q = supabase.from('expenses').select(SELECT).order('spent_on', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  if (clientId) q = q.eq('client_id', clientId)
  if (category) q = q.eq('category', category)
  if (from) q = q.gte('spent_on', from)
  if (to) q = q.lte('spent_on', to)
  if (status === 'unbilled') q = q.is('invoiced_on_invoice_id', null)
  if (status === 'billed') q = q.not('invoiced_on_invoice_id', 'is', null)
  const { data, error } = await q
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createExpense(payload) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...payload, user_id: await uid() })
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateExpense(id, patch) {
  const { data, error } = await supabase.from('expenses').update(patch).eq('id', id).select(SELECT).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function uploadReceipt(file) {
  validateReceiptFile(file)
  const userId = await uid()
  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const path = `${userId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw mapPostgresError(error)
  return path
}

export async function removeReceipt(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error && error.message && !/not found/i.test(error.message)) throw mapPostgresError(error)
}

export async function getReceiptUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) throw mapPostgresError(error || {})
  return data.signedUrl
}

export async function generateInvoiceFromExpenses(clientId) {
  const { data, error } = await supabase.rpc('generate_invoice_from_expenses', { p_client_id: clientId })
  if (error) throw mapPostgresError(error)
  return data // new invoice id
}
