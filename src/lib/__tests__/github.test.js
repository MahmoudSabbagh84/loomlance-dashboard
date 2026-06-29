import { describe, it, expect } from 'vitest'
import { buildInstallUrl } from '@/lib/github'

describe('buildInstallUrl', () => {
  it('builds the GitHub App install URL with an encoded state nonce', () => {
    expect(buildInstallUrl('loomlance', 'abc-123')).toBe(
      'https://github.com/apps/loomlance/installations/new?state=abc-123',
    )
  })
  it('encodes special characters in the nonce', () => {
    expect(buildInstallUrl('loomlance', 'a/b c')).toBe(
      'https://github.com/apps/loomlance/installations/new?state=a%2Fb%20c',
    )
  })
})
