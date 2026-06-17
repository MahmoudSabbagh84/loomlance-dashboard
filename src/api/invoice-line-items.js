import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function replaceLineItems(invoiceId, items) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const { error: delErr } = await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId)
  if (delErr) throw mapPostgresError(delErr)
  if (!items.length) return []
  const rows = items.map((li, i) => ({ ...li, invoice_id: invoiceId, user_id: userId, position: li.position ?? i }))
  const { data, error } = await supabase.from('invoice_line_items').insert(rows).select()
  if (error) throw mapPostgresError(error)
  return data
}
