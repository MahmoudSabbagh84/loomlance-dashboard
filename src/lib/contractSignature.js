// src/lib/contractSignature.js — pure guards for contract signing.

// A contract can be signed only while awaiting signature.
export function canSign(status) {
  return status === 'sent'
}

// The client must provide a name, tick consent, and draw a signature.
export function validSignInput({ name, consent, signatureImage } = {}) {
  return Boolean(name && name.trim()) && consent === true && Boolean(signatureImage)
}
