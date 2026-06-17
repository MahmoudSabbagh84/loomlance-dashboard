import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listInvoices({ clientId, projectId, status, search = '', currency, sort = { field: 'issue_date', dir: 'desc' }, page = 0, pageSize = 25 } = {}) {
  let q = supabase.from('invoices').select('*, clients(name), projects(name)', { count: 'exact' })
  if (clientId) q = q.eq('client_id', clientId)
  if (projectId) q = q.eq('project_id', projectId)
  if (status) q = q.eq('status', status)
  if (currency) q = q.eq('currency', currency)
  if (search) q = q.ilike('invoice_number', `%${search}%`)
  q = q.order(sort.field, { ascending: sort.dir === 'asc' })
  q = q.range(page * pageSize, page * pageSize + pageSize - 1)
  const { data, error, count } = await q
  if (error) throw mapPostgresError(error)
  return { rows: data || [], total: count || 0 }
}

export async function getInvoice(id) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients(*), projects(name), invoice_line_items(*), invoice_payments(*)')
    .eq('id', id)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function nextInvoiceNumber() {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const { data, error } = await supabase.rpc('next_invoice_number', { p_user_id: userId })
  if (error) throw mapPostgresError(error)
  return data
}

export async function createInvoice({ line_items, ...input }) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({ ...input, user_id: userId })
    .select()
    .single()
  if (error) throw mapPostgresError(error)
  if (line_items?.length) {
    const rows = line_items.map((li, i) => ({ ...li, invoice_id: invoice.id, user_id: userId, position: li.position ?? i }))
    const { error: liErr } = await supabase.from('invoice_line_items').insert(rows)
    if (liErr) throw mapPostgresError(liErr)
  }
  return invoice
}

export async function updateInvoice(id, patch) {
  const { data, error } = await supabase.from('invoices').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteInvoice(id) {
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function duplicateInvoice(sourceId) {
  const src = await getInvoice(sourceId)
  const newNumber = await nextInvoiceNumber()
  const todayIso = new Date().toISOString().slice(0, 10)
  return createInvoice({
    client_id: src.client_id,
    project_id: src.project_id,
    invoice_number: newNumber,
    issue_date: todayIso,
    due_date: todayIso,
    currency: src.currency,
    notes: src.notes,
    terms: src.terms,
    payment_instructions: src.payment_instructions,
    line_items: (src.invoice_line_items || []).map(({ id, invoice_id, user_id, created_at, updated_at, ...rest }) => rest),
  })
}
