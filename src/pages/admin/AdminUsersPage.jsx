import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserSearch } from 'lucide-react'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import { relativeTime } from '@/lib/date'

const TIER_LABEL = { free: 'Free', tier_1: 'Tier 1', tier_2: 'Tier 2' }
const DEMO_USER_ID = 'd3a70000-0000-4000-8000-000000000001'

export function isBanned(u) {
  return !!u.banned_until && new Date(u.banned_until) > new Date()
}

export default function AdminUsersPage() {
  const { data: users, isLoading, isError, refetch } = useAdminUsers()
  const [q, setQ] = useState('')

  const filtered = (users ?? []).filter((u) => {
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    return u.email.toLowerCase().includes(needle) || (u.display_name ?? '').toLowerCase().includes(needle)
  })

  return (
    <div className="space-y-5">
      <AdminTabs />
      <PageHeader title="Users" subtitle="Every account — subscription, activity, and support actions" />
      <Input
        placeholder="Search by email or name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
        aria-label="Search users"
      />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Couldn’t load users"
          description="The user service didn’t respond. Your data is unaffected."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserSearch} title="No users match" description={`Nothing found for “${q}”.`} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Email</TH>
              <TH>Name</TH>
              <TH>Tier</TH>
              <TH>Status</TH>
              <TH>Last sign-in</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {filtered.map((u) => (
              <TR key={u.id}>
                <TD>
                  <Link to={`/admin/users/${u.id}`} className="font-medium text-fg hover:text-primary">
                    {u.email}
                  </Link>
                </TD>
                <TD className="text-fg-muted">{u.display_name || '—'}</TD>
                <TD>
                  <Badge variant={u.subscription_tier === 'free' ? 'default' : 'primary'}>
                    {TIER_LABEL[u.subscription_tier] ?? u.subscription_tier}
                  </Badge>
                </TD>
                <TD className="text-fg-muted">{u.subscription_status.replace('_', ' ')}</TD>
                <TD className="text-fg-muted">{u.last_sign_in_at ? relativeTime(u.last_sign_in_at) : 'never'}</TD>
                <TD>
                  <span className="flex items-center justify-end gap-1.5">
                    {isBanned(u) && <Badge variant="danger">Banned</Badge>}
                    {u.is_admin && <Badge variant="info">Admin</Badge>}
                    {u.id === DEMO_USER_ID && <Badge>Demo</Badge>}
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
