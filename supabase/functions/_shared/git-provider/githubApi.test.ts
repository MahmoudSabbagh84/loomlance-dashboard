import { describe, it, expect } from 'vitest'
import { createAppJwt } from './githubApi'

function derToPem(der: ArrayBuffer): string {
  const bytes = new Uint8Array(der)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = btoa(bin).match(/.{1,64}/g)!.join('\n')
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`
}
function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
async function genKey() {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  )
}

describe('createAppJwt', () => {
  it('produces a verifiable RS256 JWT with the right claims', async () => {
    const kp = await genKey()
    const pem = derToPem(await crypto.subtle.exportKey('pkcs8', kp.privateKey))
    const now = 1700000000
    const jwt = await createAppJwt('123456', pem, now)
    const [h, p, s] = jwt.split('.')
    const enc = new TextEncoder()
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kp.publicKey, b64urlToBytes(s), enc.encode(`${h}.${p}`))
    expect(ok).toBe(true)
    expect(JSON.parse(new TextDecoder().decode(b64urlToBytes(h)))).toEqual({ alg: 'RS256', typ: 'JWT' })
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)))
    expect(payload.iss).toBe('123456')
    expect(payload.iat).toBe(now - 60)
    expect(payload.exp).toBe(now + 540)
  })

  it('tolerates \\n-escaped PEM (env-var form)', async () => {
    const kp = await genKey()
    const pem = derToPem(await crypto.subtle.exportKey('pkcs8', kp.privateKey)).replace(/\n/g, '\\n')
    const jwt = await createAppJwt('1', pem, 1700000000)
    const [h, p, s] = jwt.split('.')
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kp.publicKey, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`))
    expect(ok).toBe(true)
  })
})
