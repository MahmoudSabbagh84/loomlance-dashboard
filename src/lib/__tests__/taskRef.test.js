import { describe, it, expect } from 'vitest'
import { taskRef, suggestTaskKey } from '@/lib/taskRef'

describe('taskRef', () => {
  it('pads the number to at least 3 digits', () => {
    expect(taskRef('LLM', 1)).toBe('LLM-001')
    expect(taskRef('API', 42)).toBe('API-042')
    expect(taskRef('ABCDE', 1234)).toBe('ABCDE-1234')
  })
  it('returns empty string when key or number is missing', () => {
    expect(taskRef('', 1)).toBe('')
    expect(taskRef('LLM', null)).toBe('')
    expect(taskRef('LLM', undefined)).toBe('')
  })
  it('treats 0 as a real number, not missing', () => {
    expect(taskRef('LLM', 0)).toBe('LLM-000')
  })
})

describe('suggestTaskKey', () => {
  it('uses initials for multi-word names', () => {
    expect(suggestTaskKey('LoomLance Mobile')).toBe('LM')
    expect(suggestTaskKey('My Cool Project App X')).toBe('MCPAX')
  })
  it('uses the first letters for a single word', () => {
    expect(suggestTaskKey('Loomlance')).toBe('LOOM')
  })
  it('uppercases and strips punctuation', () => {
    expect(suggestTaskKey('acme-corp')).toBe('AC')
  })
  it('falls back to PRJ when empty', () => {
    expect(suggestTaskKey('')).toBe('PRJ')
    expect(suggestTaskKey('   ')).toBe('PRJ')
  })
  it('always starts with a letter', () => {
    expect(suggestTaskKey('123 build')).toMatch(/^[A-Z]/)
    expect(suggestTaskKey('123 build')).toBe('P1B')
  })
  it('produces at least 2 characters', () => {
    expect(suggestTaskKey('A').length).toBeGreaterThanOrEqual(2)
  })
  it('never exceeds 5 characters', () => {
    expect(suggestTaskKey('one two three four five six').length).toBeLessThanOrEqual(5)
  })
})
