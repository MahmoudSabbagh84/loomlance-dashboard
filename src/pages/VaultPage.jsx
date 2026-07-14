import { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Plus, Eye, EyeOff, Copy, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { VaultEntryModal } from '@/features/vault/VaultEntryModal'
import { useVaultCredentials, useRevealVaultSecret, useDeleteVaultCredential } from '@/hooks/useVault'
import { useProfile } from '@/hooks/useProfile'
import { hasFeature, FEATURES } from '@/lib/tier'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { relativeTime } from '@/lib/date'

const TYPE_LABEL = {
  api_key: 'API key',
  login: 'Login',
  database_url: 'Database URL',
  env: '.env',
  ssh_key: 'SSH key',
  note: 'Note',
}

const selectClass = 'h-10 rounded-md border border-border bg-bg px-3 text-sm'

export default function VaultPage() {
  const { data: rows, isLoading } = useVaultCredentials()
  const reveal = useRevealVaultSecret()
  const del = useDeleteVaultCredential()
  const [editing, setEditing] = useState(null) // entry, {} for new, or null (closed)
  const [confirmId, setConfirmId] = useState(null)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [shown, setShown] = useState({}) // id -> plaintext (transient)

  const revealInto = (id, then) =>
    reveal.mutate(id, {
      onSuccess: (value) => then(value),
      onError: (e) => toast.error(e.userMessage || e.message),
    })
  const onReveal = (id) =>
    revealInto(id, (value) => {
      setShown((s) => ({ ...s, [id]: value }))
      setTimeout(() => setShown((s) => ({ ...s, [id]: undefined })), 30000)
    })
  const onCopy = (id) =>
    revealInto(id, async (value) => {
      try {
        await navigator.clipboard.writeText(value)
        toast.success('Copied')
      } catch {
        toast.error('Could not copy')
      }
    })

  const filtered = (rows ?? []).filter(
    (r) =>
      (!typeFilter || r.type === typeFilter) &&
      (!q || `${r.label} ${r.username ?? ''} ${r.url ?? ''} ${r.notes ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  )

  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  if (!hasFeature(tier, FEATURES.VAULT)) {
    return (
      <div className="space-y-4">
        <PageHeader title="Vault" subtitle="Encrypted API keys, secrets, and client credentials." />
        <UpgradeCard feature={FEATURES.VAULT} currentTier={tier} target="tier_1" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Vault" subtitle="Encrypted API keys, secrets, and client credentials.">
        <Button onClick={() => setEditing({})}>
          <Plus className="size-4" /> New credential
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" aria-label="Search credentials" />
        <select aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectClass}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : !filtered.length ? (
        <EmptyState
          icon={KeyRound}
          title="No credentials yet"
          description="Stop scattering API keys and .env secrets across notes and chats. Store them here, encrypted."
        />
      ) : (
        <Card className="divide-y divide-border p-0">
          {filtered.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
              <KeyRound className="size-4 shrink-0 text-fg-subtle" />
              <span className="font-medium text-fg">{r.label}</span>
              <Badge variant="default">{TYPE_LABEL[r.type] ?? r.type}</Badge>
              {r.username ? <span className="text-sm text-fg-muted">{r.username}</span> : null}
              <code className="font-mono text-sm text-fg-muted">{shown[r.id] ?? '••••••••'}</code>
              <span className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={shown[r.id] ? 'Hide' : 'Reveal'}
                  onClick={() => (shown[r.id] ? setShown((s) => ({ ...s, [r.id]: undefined })) : onReveal(r.id))}
                >
                  {shown[r.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                <Button size="sm" variant="ghost" aria-label="Copy" onClick={() => onCopy(r.id)}>
                  <Copy className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(r)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => setConfirmId(r.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </span>
              {r.last_accessed_at ? (
                <span className="w-full text-xs text-fg-subtle">Last viewed {relativeTime(r.last_accessed_at)}</span>
              ) : null}
            </div>
          ))}
        </Card>
      )}

      {editing !== null && <VaultEntryModal open entry={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!confirmId}
        title="Delete credential?"
        body="This permanently deletes the credential."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          del.mutate(confirmId, { onSuccess: () => toast.success('Deleted') })
          setConfirmId(null)
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
