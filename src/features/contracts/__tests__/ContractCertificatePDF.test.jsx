import { describe, it, expect } from 'vitest'
import { buildContractCertificateBlob } from '../ContractCertificatePDF'

describe('ContractCertificatePDF', () => {
  it('builds a certificate blob for a signed contract', async () => {
    const blob = await buildContractCertificateBlob({
      contract: {
        title: 'Design retainer',
        description: 'Terms…',
        value: 5000,
        currency: 'USD',
        signer_name: 'Jane Client',
        signature_image: 'data:image/png;base64,iVBORw0KGgo=',
        signed_at: '2026-07-09T00:00:00Z',
        signer_ip: '1.2.3.4',
        content_hash: 'abc123',
      },
      client: { name: 'Acme' },
      profile: { business_name: 'DevShop' },
    })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
