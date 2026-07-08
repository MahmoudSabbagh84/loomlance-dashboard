// supabase/functions/_shared/vaultCrypto.ts
// Envelope encryption (AES-256-GCM). Portable: uses only globalThis.crypto (Deno + Node 18+).
// Per entry: a random data key (DEK) encrypts the secret; the DEK is wrapped by the master key (KEK).
// The GCM auth tag is appended to the ciphertext by WebCrypto, so each blob is one stored value.
const b64 = (buf: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function importKek(kekB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', unb64(kekB64), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(plaintext: string, kekB64: string) {
  const kek = await importKek(kekB64)
  const dekRaw = crypto.getRandomValues(new Uint8Array(32))
  const dek = await crypto.subtle.importKey('raw', dekRaw, 'AES-GCM', false, ['encrypt', 'decrypt'])
  const secretIv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: secretIv }, dek, new TextEncoder().encode(plaintext))
  const dekIv = crypto.getRandomValues(new Uint8Array(12))
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: dekIv }, kek, dekRaw)
  return {
    secret_ciphertext: b64(ct),
    secret_iv: b64(secretIv.buffer),
    wrapped_dek: b64(wrapped),
    dek_iv: b64(dekIv.buffer),
  }
}

export async function decryptSecret(
  rec: { secret_ciphertext: string; secret_iv: string; wrapped_dek: string; dek_iv: string },
  kekB64: string,
): Promise<string> {
  const kek = await importKek(kekB64)
  const dekRaw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.dek_iv) }, kek, unb64(rec.wrapped_dek))
  const dek = await crypto.subtle.importKey('raw', dekRaw, 'AES-GCM', false, ['encrypt', 'decrypt'])
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.secret_iv) }, dek, unb64(rec.secret_ciphertext))
  return new TextDecoder().decode(pt)
}
