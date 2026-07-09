import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, XCircle, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Skeleton } from '@/components/ui/Skeleton'
import { SignaturePad } from '@/features/contracts/SignaturePad'
import { usePublicContract, useSignContract, useDeclineContract } from '@/hooks/usePublicContract'
import { validSignInput } from '@/lib/contractSignature'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'

export default function PublicContractPage() {
  const { token } = useParams()
  const { data, isLoading } = usePublicContract(token)
  const sign = useSignContract()
  const decline = useDeclineContract()
  const [name, setName] = useState('')
  const [sig, setSig] = useState('')
  const [consent, setConsent] = useState(false)
  const [reason, setReason] = useState('')
  const [justSigned, setJustSigned] = useState(null) // { content_hash } after a successful sign
  const [justDeclined, setJustDeclined] = useState(false)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold">This link is no longer valid</h1>
          <p className="mt-1 text-sm text-fg-muted">Ask the sender for an up-to-date link.</p>
        </div>
      </div>
    )
  }

  const signed = data.already_signed || !!justSigned
  // Declined/withdrawn/cancelled: not signed, not the active sign state, and this session didn't just decline.
  const unavailable = !signed && !justDeclined && data.status !== 'sent'
  const canSubmit = validSignInput({ name, consent, signatureImage: sig })

  const onSign = () => {
    if (!canSubmit) return
    sign.mutate(
      { token, name: name.trim(), signatureImage: sig, consent },
      {
        onSuccess: (res) => {
          if (res?.ok) {
            setJustSigned(res)
            toast.success('Contract signed')
          } else if (res?.already) {
            toast('This contract was already signed')
          } else {
            toast.error('Could not sign — please check the form')
          }
        },
        onError: (e) => toast.error(e.userMessage || e.message),
      }
    )
  }

  const onDecline = () => {
    decline.mutate(
      { token, reason: reason.trim() || null },
      {
        onSuccess: (res) => {
          if (res?.ok) {
            setJustDeclined(true)
            toast('Contract declined')
          } else if (res?.already) {
            toast('This contract was already decided')
          }
        },
        onError: (e) => toast.error(e.userMessage || e.message),
      }
    )
  }

  const downloadCertificate = async () => {
    const { buildContractCertificateBlob } = await import('@/features/contracts/ContractCertificatePDF')
    const blob = await buildContractCertificateBlob({
      contract: {
        ...data,
        signer_name: name || data.signer_name,
        signature_image: sig,
        signed_at: new Date().toISOString(),
        content_hash: justSigned?.content_hash,
      },
      client: { name: data.client_name },
      profile: { business_name: data.business_name },
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.title || 'contract'}-signed.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="text-center">
          <p className="text-sm text-fg-muted">{data.business_name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">Contract</h1>
        </div>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-fg">{data.title}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-fg-muted">Value</p>
              <p className="font-medium text-fg">{data.value != null ? formatCurrency(Number(data.value), data.currency) : '—'}</p>
            </div>
            <div>
              <p className="text-fg-muted">Term</p>
              <p className="font-medium text-fg">
                {data.start_date ? formatDate(data.start_date) : '—'}
                {data.end_date ? ` – ${formatDate(data.end_date)}` : ''}
              </p>
            </div>
          </div>
          {data.description ? (
            <div className="border-t border-border pt-3">
              <p className="whitespace-pre-wrap text-sm text-fg-muted">{data.description}</p>
            </div>
          ) : null}
          {data.signing_pdf_url ? (
            <a href={data.signing_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <FileText className="size-4" /> View the full contract (PDF)
            </a>
          ) : null}
        </Card>

        {signed ? (
          <Card className="flex items-center gap-3">
            <CheckCircle2 className="size-6 shrink-0 text-success" />
            <div className="flex-1">
              <p className="font-medium text-fg">Signed</p>
              <p className="text-sm text-fg-muted">
                by {justSigned ? name : data.signer_name}
                {data.signed_at ? ` on ${formatDate(data.signed_at)}` : ''}
              </p>
            </div>
            {justSigned ? (
              <Button size="sm" variant="secondary" onClick={downloadCertificate}>
                Download signed certificate
              </Button>
            ) : null}
          </Card>
        ) : justDeclined ? (
          <Card className="flex items-center gap-3">
            <XCircle className="size-6 shrink-0 text-danger" />
            <p className="font-medium text-fg">You declined this contract</p>
          </Card>
        ) : unavailable ? (
          <Card>
            <p className="text-sm text-fg-muted">This contract is no longer available for signing.</p>
          </Card>
        ) : (
          <Card className="space-y-4">
            <div>
              <Label htmlFor="signer-name" required>Full name</Label>
              <Input id="signer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your full legal name" />
            </div>
            <div>
              <Label>Signature</Label>
              <SignaturePad value={sig} onChange={setSig} />
            </div>
            <label className="flex items-start gap-2 text-sm text-fg-muted">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I agree to these terms, and intend this as my electronic signature.</span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={onSign} loading={sign.isPending} disabled={!canSubmit}>
                Sign
              </Button>
            </div>
            <details className="text-sm text-fg-muted">
              <summary className="cursor-pointer">Decline this contract instead</summary>
              <div className="mt-2 space-y-2">
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
                <Button variant="secondary" loading={decline.isPending} onClick={onDecline}>
                  Decline
                </Button>
              </div>
            </details>
          </Card>
        )}
      </div>
    </div>
  )
}
