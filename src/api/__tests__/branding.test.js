import { describe, it, expect } from 'vitest'
import { validateLogoFile, logoPathFromUrl, LOGO_MAX_BYTES } from '@/api/branding'

describe('validateLogoFile', () => {
  it('accepts a small png', () => {
    expect(() => validateLogoFile({ type: 'image/png', size: 1000 })).not.toThrow()
  })
  it('accepts svg', () => {
    expect(() => validateLogoFile({ type: 'image/svg+xml', size: 1000 })).not.toThrow()
  })
  it('rejects a non-image', () => {
    expect(() => validateLogoFile({ type: 'application/pdf', size: 1000 })).toThrow(/image/i)
  })
  it('rejects an oversize file', () => {
    expect(() => validateLogoFile({ type: 'image/png', size: LOGO_MAX_BYTES + 1 })).toThrow(/2 ?MB/i)
  })
})

describe('logoPathFromUrl', () => {
  it('extracts the storage path from a public url', () => {
    const url = 'https://ref.supabase.co/storage/v1/object/public/branding-logos/abc-123/logo-9.png'
    expect(logoPathFromUrl(url)).toBe('abc-123/logo-9.png')
  })
  it('returns null for an unrelated url', () => {
    expect(logoPathFromUrl('https://example.com/x.png')).toBe(null)
  })
})
