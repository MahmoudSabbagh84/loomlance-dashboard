import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw mapPostgresError(error)
  return data.session
}

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw mapPostgresError(error)
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw mapPostgresError(error)
}

export async function requestPasswordReset(email) {
  const redirectTo = `${import.meta.env.VITE_PUBLIC_SITE_URL}/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw mapPostgresError(error)
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw mapPostgresError(error)
}

export function onAuthStateChange(handler) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => handler(event, session))
  return () => data.subscription.unsubscribe()
}
