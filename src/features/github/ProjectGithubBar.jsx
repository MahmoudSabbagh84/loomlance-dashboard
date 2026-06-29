import { useState } from 'react'
import { toast } from 'sonner'
import { Github, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { listRepos } from '@/api/github'
import { useGithubInstallation, useProjectRepo, useLinkRepo, useDisconnectRepo } from '@/hooks/useGithub'
import { taskRef } from '@/lib/taskRef'

export function ProjectGithubBar({ project }) {
  const projectId = project.id
  const { data: installation } = useGithubInstallation()
  const { data: repo } = useProjectRepo(projectId)
  const link = useLinkRepo(projectId)
  const disconnect = useDisconnectRepo(projectId)
  const [repos, setRepos] = useState(null) // null = not loaded, [] = loaded empty
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [selected, setSelected] = useState('')

  if (!installation) return null

  const openPicker = async () => {
    setPicking(true)
    if (repos) return
    setLoading(true)
    try {
      const r = await listRepos()
      setRepos(r?.repos || [])
    } catch (e) {
      toast.error(e.userMessage || 'Could not load repositories')
      setPicking(false)
    } finally {
      setLoading(false)
    }
  }

  const onPick = async (e) => {
    const repoId = e.target.value
    setSelected(repoId)
    if (!repoId) return
    const chosen = (repos || []).find((x) => String(x.id) === String(repoId))
    if (!chosen) return
    try {
      const res = await link.mutateAsync({
        projectId,
        repoId: chosen.id,
        repoFullName: chosen.full_name,
        defaultBranch: chosen.default_branch,
      })
      toast.success(`Linked ${chosen.full_name}${res?.issuesImported ? ` · ${res.issuesImported} issues imported` : ''}`)
      setPicking(false)
    } catch (err) {
      toast.error(err.userMessage || 'Could not link the repository')
      setSelected('')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-elevated p-3 text-sm">
      <Github className="size-4 text-fg-muted" />
      {repo ? (
        <>
          <span className="font-medium text-fg">{repo.repo_full_name}</span>
          <span className="text-fg-muted">
            Commits like{' '}
            <code className="rounded bg-bg-muted px-1">{taskRef(project.task_key, 1)} done</code>{' '}
            complete tasks; open issues show in the board.
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() =>
              disconnect.mutate(undefined, {
                onSuccess: () => toast.success('Repository disconnected'),
              })
            }
            loading={disconnect.isPending}
          >
            <X className="size-4" /> Disconnect
          </Button>
        </>
      ) : picking ? (
        <Select onChange={onPick} value={selected} disabled={loading || link.isPending} className="max-w-xs">
          <option value="" disabled>
            {loading ? 'Loading…' : 'Choose a repository'}
          </option>
          {(repos || []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </Select>
      ) : (
        <>
          <span className="text-fg-muted">
            Link a GitHub repository to mirror its issues and complete tasks from commits.
          </span>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={openPicker}>
            Connect a repository
          </Button>
        </>
      )}
    </div>
  )
}
