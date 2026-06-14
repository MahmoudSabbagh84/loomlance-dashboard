import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function getMyProfile() {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateMyProfile(patch) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw mapPostgresError(error)
  return data
}
