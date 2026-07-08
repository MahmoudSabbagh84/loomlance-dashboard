import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { createInvoice, nextInvoiceNumber } from '@/api/invoices'

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

// Approved change → a draft invoice with the change as a single line item.
export async function billChangeRequest(cr) {
  const invoice_number = await nextInvoiceNumber()
  const today = new Date().toISOString().slice(0, 10)
  const invoice = await createInvoice({
    client_id: cr.client_id,
    project_id: cr.project_id,
    invoice_number,
    issue_date: today,
    due_date: today,
    currency: cr.currency,
    line_items: [
      {
        description: cr.title,
        quantity: cr.hours ?? 1,
        unit_price: cr.hourly_rate ?? cr.amount,
        tax_rate: 0,
        discount_rate: 0,
      },
    ],
  })
  await updateChangeRequest(cr.id, { billed_invoice_id: invoice.id })
  return invoice
}
