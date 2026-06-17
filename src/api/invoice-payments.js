import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listPayments(invoiceId) {
  const { data, error } = await supabase.from('invoice_payments').select('*').eq('invoice_id', invoiceId).order('paid_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createPayment(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const { data, error } = await supabase
    .from('invoice_payments')
    .insert({ ...input, user_id: userId })
    .select()
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deletePayment(id) {
  const { error } = await supabase.from('invoice_payments').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}
