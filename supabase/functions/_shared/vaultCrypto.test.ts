// supabase/functions/_shared/vaultCrypto.test.ts
import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret } from './vaultCrypto.ts'

// A deterministic 32-byte test KEK (base64).
const KEK = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 1)))

describe('vaultCrypto envelope', () => {
  it('round-trips a secret', async () => {
    const enc = await encryptSecret('sk_live_deadbeef', KEK)
    expect(enc.secret_ciphertext).toBeTruthy()
    expect(await decryptSecret(enc, KEK)).toBe('sk_live_deadbeef')
  })
  it('round-trips a multiline .env blob', async () => {
    const env = 'DB_URL=postgres://x\nAPI_KEY=abc\n'
    expect(await decryptSecret(await encryptSecret(env, KEK), KEK)).toBe(env)
  })
  it('is non-deterministic (unique DEK/iv per call)', async () => {
    const a = await encryptSecret('same', KEK)
    const b = await encryptSecret('same', KEK)
    expect(a.secret_ciphertext).not.toBe(b.secret_ciphertext)
  })
  it('fails to decrypt with the wrong key', async () => {
    const enc = await encryptSecret('secret', KEK)
    const wrong = btoa(String.fromCharCode(...new Uint8Array(32).map(() => 9)))
    await expect(decryptSecret(enc, wrong)).rejects.toThrow()
  })
  it('fails to decrypt tampered ciphertext', async () => {
    const enc = await encryptSecret('secret', KEK)
    const bad = { ...enc, secret_ciphertext: btoa('tampered-nonsense') }
    await expect(decryptSecret(bad, KEK)).rejects.toThrow()
  })
})
