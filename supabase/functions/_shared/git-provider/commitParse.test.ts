import { describe, it, expect } from 'vitest'
import { parseCommit, hasKeyword } from './commitParse'

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
