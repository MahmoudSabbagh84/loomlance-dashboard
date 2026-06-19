import { supabase } from '@/lib/supabase'
import { AppError, mapPostgresError } from '@/lib/errors'

const SELECT =
  'id, client_id, project_id, title, cadence, line_items, currency, due_days, notes, next_run_at, end_date, active, last_generated_at, clients(name), projects(name)'

async function uid() {
  const { data } = await supabase.auth.getSession()
  const id = data?.session?.user?.id
  if (!id) throw new AppError('UNAUTHORIZED', 'You must be signed in.')
  return id
}

export async function listTemplates() {
  const { data, error } = await supabase
    .from('recurring_invoice_templates')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createTemplate(payload) {
  const { data, error } = await supabase
    .from('recurring_invoice_templates')
    .insert({ ...payload, user_id: await uid() })
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateTemplate(id, patch) {
  const { data, error } = await supabase
    .from('recurring_invoice_templates')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('recurring_invoice_templates').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function setActive(id, active) {
  return updateTemplate(id, { active })
}

export async function generateNow(templateId) {
  const { data, error } = await supabase.rpc('generate_recurring_invoice_now', { p_template_id: templateId })
  if (error) throw mapPostgresError(error)
  return data // new invoice id
}
