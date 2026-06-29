// Pure smart-commit parsing/resolution for the GitHub integration.
// No Deno/Supabase imports: Vitest unit-tests this file directly, and the
// github-webhook Edge Function imports it (with the .ts extension) at runtime.

const KEYWORDS: ReadonlySet<string> = new Set([
  'done', 'complete', 'completed', 'close', 'closes', 'closed',
  'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved',
  // curated common misspellings (NOT blind fuzzing — avoids false positives like "dont")
  'doen', 'donne', 'completd', 'compelted', 'clsoe', 'cloes', 'fixs', 'resloves', 'resoled',
])

const WORD_RE = /[a-z]+/g
const REF_RE = /\b([A-Za-z]{2,5})[-\s#]0*(\d+)\b/g

export function hasKeyword(message: string): boolean {
  const lower = String(message ?? '').toLowerCase()
  let m: RegExpExecArray | null
  WORD_RE.lastIndex = 0
  while ((m = WORD_RE.exec(lower)) !== null) {
    if (KEYWORDS.has(m[0])) return true
  }
  return false
}

// Extract normalized { key, number } refs that co-occur with a completion keyword.
// A ref whose key is itself a keyword (e.g. "Fixes #12") is discarded — GitHub's own
// issue-closing syntax must not be treated as a LoomLance task ref.
export function parseCommit(message: string): Array<{ key: string; number: number }> {
  const text = String(message ?? '')
  if (!hasKeyword(text)) return []
  const out: Array<{ key: string; number: number }> = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  REF_RE.lastIndex = 0
  while ((m = REF_RE.exec(text)) !== null) {
    if (KEYWORDS.has(m[1].toLowerCase())) continue
    const key = m[1].toUpperCase()
    const number = parseInt(m[2], 10)
    const id = `${key}-${number}`
    if (!seen.has(id)) {
      seen.add(id)
      out.push({ key, number })
    }
  }
  return out
}
