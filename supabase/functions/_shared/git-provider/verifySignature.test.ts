import { describe, it, expect } from 'vitest'
import { computeSignature, verifyGithubSignature } from './verifySignature'

describe('github signature', () => {
  const secret = 'test-secret'
  const body = '{"action":"opened"}'

  it('computes a sha256= hex HMAC', async () => {
    expect(await computeSignature(body, secret)).toMatch(/^sha256=[0-9a-f]{64}$/)
  })
  it('verifies a correct signature', async () => {
    const sig = await computeSignature(body, secret)
    expect(await verifyGithubSignature(body, sig, secret)).toBe(true)
  })
  it('rejects a tampered body', async () => {
    const sig = await computeSignature(body, secret)
    expect(await verifyGithubSignature(body + ' ', sig, secret)).toBe(false)
  })
  it('rejects a wrong secret', async () => {
    const sig = await computeSignature(body, secret)
    expect(await verifyGithubSignature(body, sig, 'other-secret')).toBe(false)
  })
  it('rejects a missing header or secret', async () => {
    expect(await verifyGithubSignature(body, null, secret)).toBe(false)
    expect(await verifyGithubSignature(body, 'sha256=00', '')).toBe(false)
  })
})
