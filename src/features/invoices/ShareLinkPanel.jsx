import { useState } from 'react'
import { Copy, RefreshCw, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useRegenerateInvoiceLink, useSetLinkExpiry } from '@/hooks/useInvoices'
import { formatDate } from '@/lib/date'

export function ShareLinkPanel({ invoice }) {
  const regen = useRegenerateInvoiceLink()
  const setExpiry = useSetLinkExpiry()
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [copied, setCopied] = useState(false)
  const base = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin
  const url = `${base}/i/${invoice.public_token}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Share link</h3>
        {invoice.viewed_at ? <span className="text-xs text-fg-muted">Viewed {formatDate(invoice.viewed_at)}</span> : null}
      </div>
      <div className="flex gap-2">
        <Input readOnly value={url} className="flex-1" onFocus={(e) => e.target.select()} />
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setConfirmRegen(true)} loading={regen.isPending}>
          <RefreshCw className="size-4" /> Regenerate link
        </Button>
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          Expires
          <Input
            type="date"
            className="h-8 w-40"
            value={invoice.link_expires_at ? invoice.link_expires_at.slice(0, 10) : ''}
            onChange={(e) =>
              setExpiry.mutate({
                id: invoice.id,
                expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
        </label>
      </div>
      <ConfirmDialog
        open={confirmRegen}
        title="Regenerate link?"
        body="This creates a new link and immediately breaks any link you’ve already shared. This cannot be undone."
        confirmLabel="Regenerate"
        variant="danger"
        loading={regen.isPending}
        onCancel={() => setConfirmRegen(false)}
        onConfirm={async () => {
          try {
            await regen.mutateAsync(invoice.id)
            toast.success('New link generated')
            setConfirmRegen(false)
          } catch (e) {
            toast.error(e.userMessage || 'Could not regenerate')
          }
        }}
      />
    </Card>
  )
}
