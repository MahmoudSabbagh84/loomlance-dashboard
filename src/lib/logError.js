import { supabase } from '@/lib/supabase'

// Best-effort client error logging to public.error_logs.
// RLS allows inserting rows for the current user (or a null user). This MUST never
// throw — a logger that breaks is worse than no logger — so everything is wrapped.

const recent = new Map() // message -> last-sent ms, to avoid flooding on repeated errors

function seenRecently(key) {
  const now = Date.now()
  const last = recent.get(key)
  recent.set(key, now)
  if (recent.size > 50) {
    for (const [k, t] of recent) if (now - t > 60_000) recent.delete(k)
  }
  return last != null && now - last < 10_000
}

export async function logError(error, context = {}) {
  try {
    const message = String((error && (error.message || error)) || 'Unknown error').slice(0, 1000)
    if (seenRecently(message)) return
    const stack = error && error.stack ? String(error.stack).slice(0, 8000) : null

    let userId = null
    try {
      const { data } = await supabase.auth.getSession()
      userId = data?.session?.user?.id ?? null
    } catch {
      /* not signed in / session unavailable — log anonymously */
    }

    await supabase.from('error_logs').insert({
      user_id: userId,
      message,
      stack,
      context: {
        url: typeof window !== 'undefined' ? window.location.pathname : null,
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        ...context,
      },
    })
  } catch {
    // Swallow — logging must never surface a new error.
  }
}

// Wire global handlers once (uncaught errors + unhandled promise rejections).
export function installGlobalErrorLogging() {
  if (typeof window === 'undefined' || window.__loomErrorLogging) return
  window.__loomErrorLogging = true
  window.addEventListener('error', (e) => {
    logError(e?.error || new Error(e?.message || 'window error'), { type: 'window.onerror' })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e?.reason
    logError(reason instanceof Error ? reason : new Error(String(reason)), { type: 'unhandledrejection' })
  })
}
