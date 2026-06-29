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

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => i)
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i]
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1])
      prev = tmp
    }
  }
  return dp[m]
}

interface ResolveOpts {
  mode: 'project' | 'cross_project'
  linkedProjectId: string | null
  projects: Array<{ id: string; task_key: string }>
}

// Map parsed refs to the tasks they should complete, honoring the user's scope mode.
// Project-scoped: only the repo's linked project, with fuzzy key correction (Levenshtein <= 1).
// Cross-project: exact key match against any of the user's projects (no fuzzy).
// Refs that resolve to no project are returned as `unmatched` (the webhook notifies on these).
export function resolveRefs(
  refs: Array<{ key: string; number: number }>,
  opts: ResolveOpts,
): { matched: Array<{ projectId: string; key: string; number: number }>; unmatched: Array<{ key: string; number: number }> } {
  const matched: Array<{ projectId: string; key: string; number: number }> = []
  const unmatched: Array<{ key: string; number: number }> = []
  const seen = new Set<string>()
  const byKey = new Map(opts.projects.map((p) => [p.task_key, p]))
  const linked = opts.projects.find((p) => p.id === opts.linkedProjectId) ?? null

  const push = (projectId: string, key: string, number: number) => {
    const id = `${projectId}-${number}`
    if (!seen.has(id)) {
      seen.add(id)
      matched.push({ projectId, key, number })
    }
  }

  for (const ref of refs) {
    if (opts.mode === 'cross_project') {
      const proj = byKey.get(ref.key)
      if (proj) push(proj.id, ref.key, ref.number)
      else unmatched.push({ key: ref.key, number: ref.number })
    } else {
      if (linked && (ref.key === linked.task_key || levenshtein(ref.key, linked.task_key) <= 1)) {
        push(linked.id, linked.task_key, ref.number)
      } else {
        unmatched.push({ key: ref.key, number: ref.number })
      }
    }
  }
  return { matched, unmatched }
}
