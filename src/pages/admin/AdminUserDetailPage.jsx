import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Copy } from 'lucide-react'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Select } from '@/components/ui/Select'
import { StatTile } from '@/features/admin/pulse/StatTile'
import { useAdminUserDetail, useCompTier, useBanUser, useUnbanUser } from '@/hooks/useAdminUsers'
import { useProfile } from '@/hooks/useProfile'
import { formatCurrency } from '@/lib/currency'
import { formatDate, relativeTime } from '@/lib/date'
import { isBanned } from './AdminUsersPage'

const DEMO_USER_ID = 'd3a70000-0000-4000-8000-000000000001'
const TIERS = ['free', 'tier_1', 'tier_2']
const TIER_LABEL = { free: 'Free', tier_1: 'Tier 1', tier_2: 'Tier 2' }

function historyLine(evt) {
  const p = evt.payload ?? {}
  if (p.action === 'comp') return `Comped ${TIER_LABEL[p.from] ?? p.from} → ${TIER_LABEL[p.to] ?? p.to} by ${p.actor_email}`
  if (p.action === 'ban') return `Banned by ${p.actor_email}`
  if (p.action === 'unban') return `Unbanned by ${p.actor_email}`
  return `${p.action} by ${p.actor_email}`
}

function Field({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-sm text-fg-muted">{label}</dt>
      <dd className="text-right text-sm text-fg">{children}</dd>
    </div>
  )
}

export default function AdminUserDetailPage() {
  const { id } = useParams()
  const { data, isLoading, isError, refetch } = useAdminUserDetail(id)
  const { data: myProfile } = useProfile()
  const comp = useCompTier()
  const ban = useBanUser()
  const unban = useUnbanUser()
  const [tier, setTier] = useState('')
  const [confirmingBan, setConfirmingBan] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-5">
        <AdminTabs />
        <PageHeader title="User" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data?.user) {
    return (
      <div className="space-y-5">
        <AdminTabs />
        <PageHeader title="User" />
        <EmptyState
          title="Couldn’t load user"
          description="The user service didn’t respond, or this account doesn’t exist."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </div>
    )
  }

  const u = data.user
  const banned = isBanned(u)
  const canBan = !banned && u.id !== myProfile?.id && u.id !== DEMO_USER_ID && !u.is_admin
  const compBlocked = u.has_stripe_subscription

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(u.id)
      toast.success('User id copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  const onComp = () =>
    comp.mutate(
      { userId: u.id, tier },
      {
        onSuccess: () => toast.success(`Comped to ${TIER_LABEL[tier]}`),
        onError: (e) => toast.error(e.userMessage || e.message),
      }
    )
  const onBan = () =>
    ban.mutate(
      { userId: u.id },
      {
        onSuccess: () => {
          toast.success('User banned')
          setConfirmingBan(false)
        },
        onError: (e) => {
          toast.error(e.userMessage || e.message)
          setConfirmingBan(false)
        },
      }
    )
  const onUnban = () =>
    unban.mutate(
      { userId: u.id },
      {
        onSuccess: () => toast.success('User unbanned'),
        onError: (e) => toast.error(e.userMessage || e.message),
      }
    )

  return (
    <div className="space-y-5">
      <AdminTabs />
      <div className="space-y-1">
        <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> All users
        </Link>
        <PageHeader title={u.email}>
          <span className="flex items-center gap-1.5">
            {banned && <Badge variant="danger">Banned</Badge>}
            {u.is_admin && <Badge variant="info">Admin</Badge>}
            {u.id === DEMO_USER_ID && <Badge>Demo</Badge>}
          </span>
        </PageHeader>
      </div>

      <Card>
        <h3 className="text-sm font-semibold">Identity</h3>
        <dl className="mt-3 divide-y divide-border">
          <Field label="Display name">{u.display_name || '—'}</Field>
          <Field label="Created">{formatDate(u.created_at)}</Field>
          <Field label="Last sign-in">{u.last_sign_in_at ? relativeTime(u.last_sign_in_at) : 'never'}</Field>
          <Field label="User id">
            <span className="inline-flex items-center gap-1.5">
              <code className="font-mono text-xs text-fg-muted">{u.id}</code>
              <button
                type="button"
                onClick={copyId}
                aria-label="Copy user id"
                className="rounded p-1 text-fg-subtle transition-colors hover:bg-bg-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Copy className="size-3.5" />
              </button>
            </span>
          </Field>
        </dl>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Subscription</h3>
        <dl className="mt-3 divide-y divide-border">
          <Field label="Tier">
            <Badge variant={u.subscription_tier === 'free' ? 'default' : 'primary'}>
              {TIER_LABEL[u.subscription_tier] ?? u.subscription_tier}
            </Badge>
          </Field>
          <Field label="Status">{u.subscription_status.replace('_', ' ')}</Field>
          <Field label="Current period ends">{u.current_period_end ? formatDate(u.current_period_end) : '—'}</Field>
          <Field label="Stripe subscription">{u.has_stripe_subscription ? 'Yes — live in Stripe' : 'None'}</Field>
        </dl>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Clients" value={data.counts.clients} />
        <StatTile label="Projects" value={data.counts.projects} />
        <StatTile
          label="Invoices"
          value={data.counts.invoices}
          sub={
            data.counts.invoiced.length
              ? data.counts.invoiced.map((i) => formatCurrency(i.total, i.currency)).join(' · ')
              : undefined
          }
        />
        <StatTile label="Hours tracked" value={data.counts.hoursTracked} />
      </div>

      <Card>
        <h3 className="text-sm font-semibold">Actions</h3>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="comp-tier" className="text-sm text-fg-muted">
            Comp tier
          </label>
          <Select
            id="comp-tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            disabled={compBlocked}
            className="w-40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Choose tier…</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </Select>
          <Button onClick={onComp} loading={comp.isPending} disabled={!tier || compBlocked}>
            Apply
          </Button>
        </div>
        {compBlocked && (
          <p className="mt-2 text-sm text-fg-muted">
            This user has a live Stripe subscription — manage it in Stripe.
          </p>
        )}

        <div className="mt-5 border-t border-border pt-4">
          {banned ? (
            <Button variant="secondary" loading={unban.isPending} onClick={onUnban}>
              Unban
            </Button>
          ) : canBan ? (
            <Button variant="danger" onClick={() => setConfirmingBan(true)}>
              Ban sign-in
            </Button>
          ) : (
            <p className="text-sm text-fg-subtle">No ban action available for this account.</p>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <h4 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Admin history</h4>
          {data.history.length === 0 ? (
            <p className="mt-2 text-sm text-fg-muted">No admin actions yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {data.history.map((evt) => (
                <li key={evt.id} className="text-sm text-fg-muted">
                  {historyLine(evt)}
                  <span className="text-fg-subtle"> · {formatDate(evt.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmingBan}
        title="Ban this user?"
        body="Blocks sign-in. Their data and public invoice links stay live. Reversible."
        confirmLabel="Ban sign-in"
        variant="danger"
        loading={ban.isPending}
        onCancel={() => setConfirmingBan(false)}
        onConfirm={onBan}
      />
    </div>
  )
}
