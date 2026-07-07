import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

// Single-row app config (id = true). World-readable; updates require is_admin() via RLS.
export async function fetchAppConfig() {
  const { data, error } = await supabase.from('app_config').select('*').eq('id', true).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateAppConfig(patch) {
  const { data, error } = await supabase.from('app_config').update(patch).eq('id', true).select().single()
  if (error) throw mapPostgresError(error)
  return data
}
