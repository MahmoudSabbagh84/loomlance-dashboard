import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePublicChangeRequest, useRespondToChangeRequest } from '@/hooks/useChangeRequests'
import { formatCurrency } from '@/lib/currency'

export default function PublicChangeRequestPage() {
  const { token } = useParams()
  const { data, isLoading } = usePublicChangeRequest(token)
  const respond = useRespondToChangeRequest()
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Skeleton className="h-80" />
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

  const decided = data.already_decided || data.status !== 'sent'
  const hoursLine =
    data.hours != null && data.hourly_rate != null
      ? ` (${data.hours}h × ${formatCurrency(Number(data.hourly_rate), data.currency)})`
      : ''

  const decide = (decision) => {
    if (decision === 'approve' && !name.trim()) {
      toast.error('Please type your name to approve')
      return
    }
    respond.mutate(
      { token, decision, approverName: name.trim() || null, reason: reason.trim() || null },
      {
        onSuccess: () => toast.success(decision === 'approve' ? 'Change approved' : 'Change declined'),
        onError: (e) => toast.error(e.userMessage || e.message),
      }
    )
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="text-center">
          <p className="text-sm text-fg-muted">{data.business_name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">Change request</h1>
        </div>

        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-fg">{data.title}</h2>
            {data.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-fg-muted">{data.description}</p> : null}
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-sm text-fg-muted">Additional cost</span>
            <span className="text-xl font-semibold tabular-nums text-fg">
              {formatCurrency(Number(data.amount), data.currency)}
              <span className="ml-1 text-xs font-normal text-fg-subtle">{hoursLine}</span>
            </span>
          </div>
          {data.added_days ? (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-fg-muted">Additional time</span>
              <span className="text-sm font-medium text-fg">+{data.added_days} days</span>
            </div>
          ) : null}
        </Card>

        {decided ? (
          <Card className="flex items-center gap-3">
            {data.status === 'approved' ? (
              <>
                <CheckCircle2 className="size-6 shrink-0 text-success" />
                <div>
                  <p className="font-medium text-fg">Approved</p>
                  {data.approver_name ? <p className="text-sm text-fg-muted">by {data.approver_name}</p> : null}
                </div>
              </>
            ) : (
              <>
                <XCircle className="size-6 shrink-0 text-danger" />
                <p className="font-medium text-fg">Declined</p>
              </>
            )}
          </Card>
        ) : (
          <Card className="space-y-4">
            <div>
              <Label htmlFor="cr-approver" required>Your name</Label>
              <Input id="cr-approver" value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your full name to approve" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button loading={respond.isPending} onClick={() => decide('approve')}>Approve change</Button>
              <Button variant="secondary" loading={respond.isPending} onClick={() => decide('decline')}>Decline</Button>
            </div>
            <details className="text-sm text-fg-muted">
              <summary className="cursor-pointer">Add a reason for declining (optional)</summary>
              <Textarea className="mt-2" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </details>
          </Card>
        )}

        {data.footer ? <p className="text-center text-xs text-fg-subtle">{data.footer}</p> : null}
      </div>
    </div>
  )
}
