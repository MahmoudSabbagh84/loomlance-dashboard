import { describe, it, expect } from 'vitest'
import { slugify } from '../slug'

describe('slugify', () => {
  it('lowercases and kebab-cases', () => {
    expect(slugify('GitHub Integration Is Here!')).toBe('github-integration-is-here')
  })
  it('collapses runs of separators and trims edge dashes', () => {
    expect(slugify('  Hello --- World_v2  ')).toBe('hello-world-v2')
  })
  it('strips diacritics and symbols', () => {
    expect(slugify('Café & Crème: 50% off')).toBe('cafe-creme-50-off')
  })
  it('returns empty string for no usable chars', () => {
    expect(slugify('!!!')).toBe('')
  })
})
