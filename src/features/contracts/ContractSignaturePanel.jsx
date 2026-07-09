import { useState } from 'react'
import { toast } from 'sonner'
import { Send, Copy, RefreshCw, CheckCircle2, Download } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useSendContract, useRegenerateContractLink } from '@/hooks/useContracts'
import { useProfile } from '@/hooks/useProfile'
import { formatDate } from '@/lib/date'

export function ContractSignaturePanel({ contract }) {
  const send = useSendContract()
  const regen = useRegenerateContractLink()
  const { data: profile } = useProfile()
  const [busy, setBusy] = useState(false)
  const base = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin
  const url = contract.public_token ? `${base}/c/${contract.public_token}` : ''
  const signed = !!contract.signed_at

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  const download = async () => {
    setBusy(true)
    try {
      const { buildContractCertificateBlob } = await import('./ContractCertificatePDF')
      const blob = await buildContractCertificateBlob({
        contract,
        client: contract.clients,
        profile: profile ?? {},
      })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `${contract.title || 'contract'}-signed.pdf`
      a.click()
      URL.revokeObjectURL(href)
    } catch (e) {
      toast.error(e.userMessage || e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold">Signature</h3>

      {signed ? (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-success" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-fg">Signed by {contract.signer_name}</p>
            <p className="text-fg-muted">
              {formatDate(contract.signed_at)}
              {contract.signer_ip ? ` · ${contract.signer_ip}` : ''}
            </p>
          </div>
          <Button size="sm" variant="secondary" loading={busy} onClick={download}>
            <Download className="size-4" /> Download signed certificate
          </Button>
        </div>
      ) : contract.public_token ? (
        <div className="space-y-2">
          <p className="text-sm text-fg-muted">Share this link with your client to sign:</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="font-mono text-xs" />
            <Button size="sm" variant="secondary" aria-label="Copy link" onClick={copy}>
              <Copy className="size-4" /> Copy
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Regenerate link"
              onClick={() =>
                regen.mutate(contract.id, {
                  onSuccess: () => toast.success('Link regenerated'),
                  onError: (e) => toast.error(e.userMessage || e.message),
                })
              }
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-fg-muted">Send this contract to your client for an electronic signature.</p>
          <Button
            size="sm"
            loading={send.isPending}
            onClick={() =>
              send.mutate(contract, {
                onSuccess: () => toast.success('Ready to share — copy the link'),
                onError: (e) => toast.error(e.userMessage || e.message),
              })
            }
          >
            <Send className="size-4" /> Send for signature
          </Button>
        </div>
      )}
    </Card>
  )
}
