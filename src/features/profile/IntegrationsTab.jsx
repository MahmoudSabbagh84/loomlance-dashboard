import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useGithubInstallation, useConnectGithub } from '@/hooks/useGithub'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { GITHUB_APP_SLUG, githubInstallUrl } from '@/lib/github'

const SCOPES = [
  { value: 'project', title: 'Project-scoped', desc: 'A commit only completes tasks in the project its repo is linked to (with typo correction).' },
  { value: 'cross_project', title: 'Cross-project', desc: 'A commit can complete tasks in any of your projects by their key (exact key match).' },
]

export function IntegrationsTab() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: installation } = useGithubInstallation()
  const connect = useConnectGithub()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [connecting, setConnecting] = useState(false)

  // Handle the post-install redirect (?installation_id=&state=).
  useEffect(() => {
    const installationId = params.get('installation_id')
    if (!installationId) return
    const state = params.get('state')
    const expected = sessionStorage.getItem('gh_install_state')
    sessionStorage.removeItem('gh_install_state')
    // Always clear the params so a refresh doesn't re-run.
    const clear = () => navigate('/profile?tab=integrations', { replace: true })
    if (!expected || state !== expected) {
      toast.error('GitHub connection could not be verified. Please try again.')
      clear()
      return
    }
    connect.mutateAsync(installationId)
      .then((r) => toast.success(`Connected to GitHub${r?.account ? ` (@${r.account})` : ''}`))
      .catch((e) => toast.error(e.userMessage || 'Could not connect GitHub'))
      .finally(clear)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const startConnect = () => {
    if (!GITHUB_APP_SLUG) { toast.error('GitHub integration is not configured yet.'); return }
    setConnecting(true)
    const nonce = crypto.randomUUID()
    sessionStorage.setItem('gh_install_state', nonce)
    window.location.href = githubInstallUrl(nonce)
  }

  const setScope = async (value) => {
    try {
      await updateProfile.mutateAsync({ commit_completion_scope: value })
      toast.success('Commit-completion scope updated')
    } catch (e) {
      toast.error(e.userMessage || 'Could not update the setting')
    }
  }

  const scope = profile?.commit_completion_scope || 'project'

  return (
    <div className="max-w-xl space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">GitHub</h3>
          {installation ? <Badge variant="success">Connected</Badge> : null}
        </div>
        {installation ? (
          <p className="text-sm text-fg-muted">
            Connected{installation.account_login ? ` as @${installation.account_login}` : ''}. Link a repository to a project from that project&apos;s page.
          </p>
        ) : (
          <>
            <p className="text-sm text-fg-muted">
              Connect GitHub to mirror a repo&apos;s open issues onto your board and complete tasks from commit messages (e.g. <code className="rounded bg-bg-muted px-1">KEY-123 done</code>).
            </p>
            <Button onClick={startConnect} loading={connecting}>Connect GitHub</Button>
          </>
        )}
      </Card>

      {installation ? (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-fg">Commit completion scope</h3>
          <div className="space-y-2">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setScope(s.value)}
                aria-pressed={scope === s.value}
                className={`block w-full rounded-lg border p-3 text-left transition-colors ${scope === s.value ? 'border-primary bg-primary/5' : 'border-border hover:border-border-strong'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-fg">{s.title}</span>
                  {s.value === 'project' ? <span className="text-xs text-fg-subtle">Default</span> : null}
                </div>
                <p className="mt-1 text-xs text-fg-muted">{s.desc}</p>
              </button>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
