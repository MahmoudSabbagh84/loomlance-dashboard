import { describe, it, expect } from 'vitest'
import { canSign, validSignInput } from '@/lib/contractSignature'

describe('canSign', () => {
  it('is true only for a sent contract', () => {
    expect(canSign('sent')).toBe(true)
    expect(canSign('draft')).toBe(false)
    expect(canSign('active')).toBe(false)
  })
})

describe('validSignInput', () => {
  it('requires a name, consent, and a signature image', () => {
    expect(validSignInput({ name: 'Jane', consent: true, signatureImage: 'data:...' })).toBe(true)
    expect(validSignInput({ name: '', consent: true, signatureImage: 'data:...' })).toBe(false)
    expect(validSignInput({ name: 'Jane', consent: false, signatureImage: 'data:...' })).toBe(false)
    expect(validSignInput({ name: 'Jane', consent: true, signatureImage: '' })).toBe(false)
  })
})
