import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listProjects({ clientId, status = 'all', search = '' } = {}) {
  let q = supabase.from('projects').select('*, clients(name)')
  if (clientId) q = q.eq('client_id', clientId)
  if (status === 'active') q = q.eq('status', 'active').is('archived_at', null)
  if (status === 'archived') q = q.not('archived_at', 'is', null)
  if (status === 'paused') q = q.eq('status', 'paused')
  if (search) q = q.ilike('name', `%${search}%`)
  q = q.order('updated_at', { ascending: false })
  const { data, error } = await q
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function getProject(id) {
  const { data, error } = await supabase.from('projects').select('*, clients(name)').eq('id', id).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function countActiveProjects() {
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .is('archived_at', null)
  if (error) throw mapPostgresError(error)
  return count || 0
}

export async function createProject(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('projects').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateProject(id, patch) {
  const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function archiveProject(id) {
  return updateProject(id, { status: 'archived', archived_at: new Date().toISOString() })
}

export async function unarchiveProject(id) {
  return updateProject(id, { status: 'active', archived_at: null })
}

export async function deleteProject(id) {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function fetchProjectFinancialsData(projectId) {
  const [inv, exp, time] = await Promise.all([
    supabase
      .from('invoices')
      .select('status, currency, invoice_line_items(quantity, unit_price, tax_rate, discount_rate), invoice_payments(amount, currency)')
      .eq('project_id', projectId),
    supabase
      .from('expenses')
      .select('amount, currency, billable, invoiced_on_invoice_id')
      .eq('project_id', projectId),
    supabase
      .from('time_entries')
      .select('duration_minutes, billable, hourly_rate, invoiced_on_invoice_id')
      .eq('project_id', projectId)
      .not('ended_at', 'is', null),
  ])
  if (inv.error) throw mapPostgresError(inv.error)
  if (exp.error) throw mapPostgresError(exp.error)
  if (time.error) throw mapPostgresError(time.error)
  return { invoices: inv.data || [], expenses: exp.data || [], timeEntries: time.data || [] }
}

export async function setProjectBudget({ projectId, amount, currency, note }) {
  const { error } = await supabase.rpc('set_project_budget', {
    p_project_id: projectId,
    p_amount: amount,
    p_currency: currency,
    p_note: note || null,
  })
  if (error) throw mapPostgresError(error)
}

export async function fetchBudgetHistory(projectId) {
  const { data, error } = await supabase
    .from('project_budget_changes')
    .select('id, previous_amount, new_amount, currency, note, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data || []
}
