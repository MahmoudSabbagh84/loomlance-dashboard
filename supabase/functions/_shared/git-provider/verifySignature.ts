// Pure HMAC-SHA256 verification of GitHub's X-Hub-Signature-256 header.
// Uses Web Crypto (global `crypto`, available in Deno and Node 20+), so Vitest tests it directly.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function computeSignature(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha256=${hex}`
}

export async function verifyGithubSignature(body: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader || !secret) return false
  const expected = await computeSignature(body, secret)
  return timingSafeEqual(expected, signatureHeader)
}
