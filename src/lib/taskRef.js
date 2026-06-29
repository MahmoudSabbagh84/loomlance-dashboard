// Format a task's human-facing reference, e.g. taskRef('LLM', 1) => 'LLM-001'.
// Returns '' when the key or number is missing (e.g. before the migration backfilled them).
export function taskRef(taskKey, refNumber) {
  if (!taskKey || refNumber == null) return ''
  return `${taskKey}-${String(refNumber).padStart(3, '0')}`
}

// Suggest a 2–5 char uppercase task key from a project name. Starts with a letter.
// Multi-word names -> initials; single word -> first 4 chars; empty -> 'PRJ'.
export function suggestTaskKey(name) {
  const cleaned = String(name || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim()
  if (!cleaned) return 'PRJ'
  const words = cleaned.split(/\s+/).filter(Boolean)
  let key = words.length >= 2 ? words.map((w) => w[0]).join('') : words[0].slice(0, 4)
  key = key.replace(/[^A-Z0-9]/g, '')
  if (!/^[A-Z]/.test(key)) key = 'P' + key
  if (key.length < 2) key = (words[0] + 'XX').slice(0, 3)
  return key.slice(0, 5)
}
