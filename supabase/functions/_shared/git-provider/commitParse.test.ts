import { describe, it, expect } from 'vitest'
import { parseCommit, hasKeyword, resolveRefs, levenshtein } from './commitParse'

describe('hasKeyword', () => {
  it('detects keywords case-insensitively and in (parens)/[brackets]', () => {
    expect(hasKeyword('all DONE here')).toBe(true)
    expect(hasKeyword('LLM-3 (done)')).toBe(true)
    expect(hasKeyword('just some wip')).toBe(false)
    expect(hasKeyword("I dont know")).toBe(false) // 'dont' is not a keyword
  })
})

describe('parseCommit', () => {
  it('extracts a ref when a completion keyword is present', () => {
    expect(parseCommit('LLM-3 done')).toEqual([{ key: 'LLM', number: 3 }])
  })
  it('returns [] with no keyword', () => {
    expect(parseCommit('LLM-3 wip')).toEqual([])
  })
  it('returns [] with a keyword but no ref', () => {
    expect(parseCommit('done with everything')).toEqual([])
  })
  it('normalizes case, separators, and zero-padding', () => {
    expect(parseCommit('done llm-003')).toEqual([{ key: 'LLM', number: 3 }])
    expect(parseCommit('LLM 3 closes')).toEqual([{ key: 'LLM', number: 3 }])
    expect(parseCommit('LLM#3 fixed')).toEqual([{ key: 'LLM', number: 3 }])
  })
  it('handles (done) and [done] forms', () => {
    expect(parseCommit('LLM-3 (done)')).toEqual([{ key: 'LLM', number: 3 }])
    expect(parseCommit('LLM-3 [done]')).toEqual([{ key: 'LLM', number: 3 }])
  })
  it('accepts curated misspellings', () => {
    expect(parseCommit('LLM-3 doen')).toEqual([{ key: 'LLM', number: 3 }])
    expect(parseCommit('API-7 clsoe')).toEqual([{ key: 'API', number: 7 }])
  })
  it('does NOT treat GitHub Closes/Fixes #N as a task ref', () => {
    expect(parseCommit('Closes #5')).toEqual([])
    expect(parseCommit('Fixes #12')).toEqual([])
  })
  it('ignores GitHub #N but captures a real task ref in the same message', () => {
    expect(parseCommit('Fixes #12, LLM-3 done')).toEqual([{ key: 'LLM', number: 3 }])
  })
  it('dedupes repeats and collects multiple distinct refs', () => {
    expect(parseCommit('done LLM-3 and API-7 and LLM-3')).toEqual([
      { key: 'LLM', number: 3 },
      { key: 'API', number: 7 },
    ])
  })
})

const PROJECTS = [
  { id: 'p-llm', task_key: 'LLM' },
  { id: 'p-api', task_key: 'API' },
]

describe('levenshtein', () => {
  it('measures single-edit distance', () => {
    expect(levenshtein('LLM', 'LLM')).toBe(0)
    expect(levenshtein('LMM', 'LLM')).toBe(1)
    expect(levenshtein('XYZ', 'LLM')).toBe(3)
  })
})

describe('resolveRefs — project-scoped (default)', () => {
  const opts = { mode: 'project', linkedProjectId: 'p-llm', projects: PROJECTS }
  it('matches the linked project by exact key', () => {
    expect(resolveRefs([{ key: 'LLM', number: 3 }], opts)).toEqual({
      matched: [{ projectId: 'p-llm', key: 'LLM', number: 3 }],
      unmatched: [],
    })
  })
  it('fuzzy-corrects a one-edit key typo to the linked project', () => {
    expect(resolveRefs([{ key: 'LMM', number: 3 }], opts)).toEqual({
      matched: [{ projectId: 'p-llm', key: 'LLM', number: 3 }],
      unmatched: [],
    })
  })
  it('does not match another project key in project-scoped mode', () => {
    expect(resolveRefs([{ key: 'API', number: 7 }], opts)).toEqual({
      matched: [],
      unmatched: [{ key: 'API', number: 7 }],
    })
  })
  it('dedupes refs that resolve to the same linked task', () => {
    expect(resolveRefs([{ key: 'LLM', number: 3 }, { key: 'LMM', number: 3 }], opts)).toEqual({
      matched: [{ projectId: 'p-llm', key: 'LLM', number: 3 }],
      unmatched: [],
    })
  })
})

describe('resolveRefs — cross-project', () => {
  const opts = { mode: 'cross_project', linkedProjectId: 'p-llm', projects: PROJECTS }
  it('matches any project by exact key', () => {
    expect(resolveRefs([{ key: 'LLM', number: 3 }, { key: 'API', number: 7 }], opts)).toEqual({
      matched: [
        { projectId: 'p-llm', key: 'LLM', number: 3 },
        { projectId: 'p-api', key: 'API', number: 7 },
      ],
      unmatched: [],
    })
  })
  it('does NOT fuzzy-correct in cross-project mode (typo -> unmatched)', () => {
    expect(resolveRefs([{ key: 'LMM', number: 3 }], opts)).toEqual({
      matched: [],
      unmatched: [{ key: 'LMM', number: 3 }],
    })
  })
})
