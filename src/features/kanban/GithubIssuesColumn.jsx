import { Github, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useGithubIssues } from '@/hooks/useGithub'

export function GithubIssuesColumn({ projectId }) {
  const { data: issues = [] } = useGithubIssues(projectId)
  return (
    <div className="flex w-72 shrink-0 flex-col self-start rounded-lg bg-bg-elevated p-3 snap-start ring-1 ring-border/60">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Github className="size-4 text-fg-muted" />
        <h3 className="truncate text-sm font-medium">GitHub Issues</h3>
        <Badge>{issues.length}</Badge>
      </div>
      <div className="flex min-h-[100px] flex-col gap-2">
        {issues.map((i) => (
          <a
            key={i.id}
            href={i.html_url || '#'}
            target="_blank"
            rel="noreferrer"
            className="group rounded-md border border-border bg-bg p-3 text-sm hover:border-border-strong"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-snug">{i.title}</p>
              <ExternalLink className="size-3.5 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span className="font-mono">#{i.issue_number}</span>
              {(i.labels || []).map((l) => (
                <span key={l} className="rounded-full bg-bg-muted px-2 py-0.5">{l}</span>
              ))}
              {i.assignee_login ? <span>@{i.assignee_login}</span> : null}
            </div>
          </a>
        ))}
        {issues.length === 0 ? <p className="px-1 text-xs text-fg-subtle">No open issues.</p> : null}
      </div>
    </div>
  )
}
