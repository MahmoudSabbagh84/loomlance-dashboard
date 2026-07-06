import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, ExternalLink, Newspaper } from 'lucide-react'
import { usePosts, useDeletePost } from '@/hooks/usePosts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const CATEGORY_LABEL = { release: 'Feature release', update: 'Product update', press: 'Press' }

export default function AdminPostsPage() {
  const { data: posts, isLoading } = usePosts()
  const del = useDeletePost()
  const navigate = useNavigate()
  const [deleteTarget, setDeleteTarget] = useState(null)

  const onDelete = async () => {
    try {
      await del.mutateAsync(deleteTarget.id)
      toast.success('Post deleted')
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e.userMessage || 'Could not delete post')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Blog posts" subtitle="Release notes, product updates, and press mentions">
        <Button onClick={() => navigate('/admin/posts/new')}>
          <Plus className="size-4" />
          New post
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : !posts?.length ? (
        <EmptyState
          icon={Newspaper}
          title="No posts yet"
          description="Write your first release note or press mention."
          action={<Button onClick={() => navigate('/admin/posts/new')}><Plus className="size-4" /> New post</Button>}
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Title</TH>
              <TH>Category</TH>
              <TH>Status</TH>
              <TH>Published</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {posts.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link to={`/admin/posts/${p.id}`} className="font-medium text-fg hover:text-primary">
                    {p.title}
                  </Link>
                  {p.external_url && (
                    <ExternalLink className="ml-1 inline size-3.5 text-fg-subtle" aria-label="Link-out post" />
                  )}
                </TD>
                <TD className="text-fg-muted">{CATEGORY_LABEL[p.category] || p.category}</TD>
                <TD>
                  <Badge variant={p.status === 'published' ? 'success' : 'default'}>{p.status}</Badge>
                </TD>
                <TD className="text-fg-muted">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString() : '—'}
                </TD>
                <TD>
                  <div className="flex items-center justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(p)}>
                      Delete
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {deleteTarget ? (
        <ConfirmDialog
          open
          title="Delete post?"
          body={`"${deleteTarget.title}" will be removed. If it was published, it disappears from the blog on the next publish run.`}
          confirmLabel="Delete"
          variant="danger"
          loading={del.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  )
}
