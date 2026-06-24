// CORS for browser-invoked Edge Functions. Instead of a blanket `*`, echo the request
// Origin only when it's in the allowlist (dashboard + splash + local dev); otherwise fall
// back to the production dashboard origin. `Vary: Origin` so caches don't mix responses.
const ALLOWED = new Set([
  'https://app.loomlance.com',
  'https://loomlance.com',
  'https://www.loomlance.com',
  'http://localhost:5173',
  'http://localhost:4173',
])

const DEFAULT_ORIGIN = 'https://app.loomlance.com'

export function corsHeadersFor(req?: Request): Record<string, string> {
  const origin = req?.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED.has(origin) ? origin : DEFAULT_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(obj: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
  })
}
