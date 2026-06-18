import { supabase } from '@/lib/supabase'
import { AppError } from '@/lib/errors'

// Invoke a Supabase Edge Function, surfacing its JSON `error` field as a friendly message.
export async function invokeEdge(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = 'Something went wrong. Please try again.'
    try {
      const ctx = await error.context?.json?.()
      if (ctx?.error) message = ctx.error
    } catch {
      /* response body unavailable — keep the generic message */
    }
    throw new AppError('UNKNOWN', message, error)
  }
  return data
}
