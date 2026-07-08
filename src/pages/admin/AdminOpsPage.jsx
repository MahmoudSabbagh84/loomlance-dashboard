import { AlertTriangle, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { useAdminOps } from '@/hooks/useAdminOps'
import { relativeTime } from '@/lib/date'

function agoLabel(ts) {
  if (!ts) return ''
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000))
  return mins === 0 ? 'Updated just now' : `Updated ${mins} min ago`
}

// Shared renderer for the three error_logs-backed feeds. Empty is the good outcome.
function ErrorList({ rows, emptyText = 'Nothing to report.' }) {
  if (!rows?.length) return <p className="text-sm text-fg-muted">{emptyText}</p>
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => {
        const tag = r.context?.source ?? r.context?.type ?? '—'
        return (
          <li key={r.id} className="py-2 first:pt-0 last:pb-0">
            <p className="text-sm text-fg">{r.message}</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              {tag} · {relativeTime(r.created_at)}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

export default function AdminOpsPage() {
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useAdminOps()

  if (isError) {
    return (
      <div className="space-y-5">
        <AdminTabs />
        <PageHeader title="Ops" />
        <EmptyState
          icon={AlertTriangle}
          title="Couldn’t load ops data"
          description="The ops service didn’t respond. Your data is unaffected."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <AdminTabs />
      <PageHeader title="Ops">
        <span className="hidden text-xs text-fg-subtle sm:inline">{agoLabel(dataUpdatedAt)}</span>
        <Button variant="secondary" loading={isFetching} onClick={() => refetch()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <h3 className="text-sm font-semibold">Cron jobs</h3>
            <div className="mt-3 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Job</TH>
                    <TH>Schedule</TH>
                    <TH>Last run</TH>
                    <TH>Status</TH>
                    <TH>Failures (7d)</TH>
                  </TR>
                </THead>
                <tbody>
                  {data.cron.map((j) => {
                    // pg_cron statuses include transient 'running'/'starting' — only 'failed'
                    // should read alarming; anything non-terminal stays neutral.
                    const statusVariant =
                      j.lastStatus === 'succeeded' ? 'success' : j.lastStatus === 'failed' ? 'danger' : 'default'
                    return (
                    <TR key={j.jobname}>
                      <TD className="font-medium text-fg">
                        {j.jobname}
                        {j.lastStatus === 'failed' && j.lastMessage ? (
                          <span className="mt-0.5 block text-xs font-normal text-fg-muted">{j.lastMessage}</span>
                        ) : null}
                      </TD>
                      <TD className="font-mono text-xs text-fg-muted">{j.schedule}</TD>
                      <TD className="text-fg-muted">{j.lastRunAt ? relativeTime(j.lastRunAt) : 'never'}</TD>
                      <TD>
                        <Badge variant={statusVariant}>{j.lastStatus ?? 'unknown'}</Badge>
                      </TD>
                      <TD>
                        {j.failures7d > 0 ? (
                          <Badge variant="danger">{j.failures7d} failed · 7d</Badge>
                        ) : (
                          <span className="text-fg-subtle">0</span>
                        )}
                      </TD>
                    </TR>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold">Stripe webhooks</h3>
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Last event per type</p>
              {data.stripe.lastByType.length ? (
                <ul className="mt-2 divide-y divide-border">
                  {data.stripe.lastByType.map((e) => (
                    <li key={e.type} className="flex items-baseline justify-between gap-4 py-2 first:pt-0">
                      <span className="font-mono text-xs text-fg">{e.type}</span>
                      <span className="text-xs text-fg-subtle">{relativeTime(e.processedAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-fg-muted">No events recorded yet.</p>
              )}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Failures</p>
              <div className="mt-2">
                <ErrorList rows={data.stripe.failures} />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold">Email send failures</h3>
            <div className="mt-3">
              <ErrorList rows={data.emailFailures} />
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold">Client errors</h3>
            <div className="mt-3">
              <ErrorList rows={data.clientErrors} />
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
