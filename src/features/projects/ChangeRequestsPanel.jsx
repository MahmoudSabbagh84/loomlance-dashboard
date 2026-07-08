import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Copy, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ChangeRequestModal } from './ChangeRequestModal'
import {
  useChangeRequests,
  useSendChangeRequest,
  useRegenerateChangeRequestLink,
  useBillChangeRequest,
} from '@/hooks/useChangeRequests'
import { formatCurrency } from '@/lib/currency'

const STATUS_VARIANT = { draft: 'default', sent: 'info', approved: 'success', declined: 'danger' }

export function ChangeRequestsPanel({ project }) {
  const { data: rows, isLoading } = useChangeRequests(project.id)
  const send = useSendChangeRequest()
  const regen = useRegenerateChangeRequestLink()
  const bill = useBillChangeRequest()
  const [creating, setCreating] = useState(false)
  const base = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin

  const copyLink = async (token) => {
    try {
      await navigator.clipboard.writeText(`${base}/cr/${token}`)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Change requests</h3>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New change request
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !rows?.length ? (
        <EmptyState title="No change requests" description="Raise one when work goes beyond the original scope." />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((cr) => {
            const billed = !!cr.billed_invoice_id
            return (
              <li key={cr.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <span className="font-medium text-fg">{cr.title}</span>
                <span className="tabular-nums text-fg-muted">{formatCurrency(Number(cr.amount), cr.currency)}</span>
                {cr.added_days ? <span className="text-xs text-fg-subtle">+{cr.added_days}d</span> : null}
                <span className="ml-auto flex items-center gap-2">
                  <Badge variant={billed ? 'default' : STATUS_VARIANT[cr.status] ?? 'default'}>
                    {billed ? 'Billed' : cr.status}
                  </Badge>
                  {cr.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={send.isPending}
                      onClick={() =>
                        send.mutate(cr.id, {
                          onSuccess: () => toast.success('Ready to share — copy the link'),
                          onError: (e) => toast.error(e.userMessage || e.message),
                        })
                      }
                    >
                      Send
                    </Button>
                  )}
                  {cr.public_token && cr.status !== 'draft' && (
                    <>
                      <Button size="sm" variant="ghost" aria-label="Copy link" onClick={() => copyLink(cr.public_token)}>
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Regenerate link"
                        onClick={() =>
                          regen.mutate(cr.id, {
                            onSuccess: () => toast.success('Link regenerated'),
                            onError: (e) => toast.error(e.userMessage || e.message),
                          })
                        }
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                    </>
                  )}
                  {cr.status === 'approved' && !billed && (
                    <Button
                      size="sm"
                      loading={bill.isPending}
                      onClick={() =>
                        bill.mutate(cr, {
                          onSuccess: () => toast.success('Draft invoice created from this change'),
                          onError: (e) => toast.error(e.userMessage || e.message),
                        })
                      }
                    >
                      Bill this change
                    </Button>
                  )}
                  {billed && (
                    <Link to={`/invoices/${cr.billed_invoice_id}`} className="text-sm text-primary hover:underline">
                      View invoice
                    </Link>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <ChangeRequestModal open={creating} project={project} onClose={() => setCreating(false)} />
    </Card>
  )
}
