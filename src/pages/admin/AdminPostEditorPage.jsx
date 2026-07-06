import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { toast } from 'sonner'
import { usePost, useCreatePost, useUpdatePost, useSetPostStatus } from '@/hooks/usePosts'
import { uploadBlogImage } from '@/api/blogImages'
import { triggerBlogPublish } from '@/api/posts'
import { slugify } from '@/lib/slug'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { Card } from '@/components/ui/Card'

const ACTIONS_URL = 'https://github.com/MahmoudSabbagh84/loomlance-splah/actions'
const EXCERPT_TARGET = 155

const EMPTY = { title: '', slug: '', category: 'update', excerpt: '', body_md: '', cover_image_url: null, external_url: '' }

export default function AdminPostEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: existing, isLoading } = usePost(id)
  const create = useCreatePost()
  const update = useUpdatePost()
  const setStatus = useSetPostStatus()

  const [form, setForm] = useState(EMPTY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (existing) {
      setForm({ ...existing, external_url: existing.external_url ?? '' })
      setSlugTouched(true)
    }
  }, [existing])

  const isPublished = existing?.status === 'published'
  const slugLocked = !!existing?.published_at // locked after first publish — URLs never break
  const preview = useMemo(
    () => ({ __html: DOMPurify.sanitize(marked.parse(form.body_md || '*Nothing to preview yet.*')) }),
    [form.body_md]
  )

  function set(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      if (field === 'title' && !slugTouched && !slugLocked) next.slug = slugify(value)
      return next
    })
  }

  function validate() {
    if (!form.title.trim()) return 'Title is required'
    if (!form.slug) return 'Slug is required'
    if (!form.excerpt.trim()) return 'Excerpt is required (it is the meta description)'
    if (form.external_url && !/^https:\/\//.test(form.external_url)) return 'External URL must start with https://'
    return null
  }

  async function save(extra = {}) {
    const err = validate()
    setError(err)
    if (err) { toast.error(err); return null }
    const fields = {
      title: form.title.trim(), slug: form.slug, category: form.category,
      excerpt: form.excerpt.trim(), body_md: form.body_md,
      cover_image_url: form.cover_image_url, external_url: form.external_url || null, ...extra,
    }
    if (existing) return update.mutateAsync({ id: existing.id, patch: fields })
    const created = await create.mutateAsync(fields)
    navigate(`/admin/posts/${created.id}`, { replace: true })
    return created
  }

  async function handlePublish() {
    try {
      const saved = await save()
      if (!saved) return
      await setStatus.mutateAsync({ id: saved.id, status: 'published' })
      await triggerBlogPublish()
      toast.success('Publish triggered — live in ~2 minutes', {
        action: { label: 'View build', onClick: () => window.open(ACTIONS_URL, '_blank') },
      })
    } catch (e) {
      toast.error(e.userMessage || e.message || 'Publish failed — the post is saved; try Publish again')
    }
  }

  async function handleUnpublish() {
    try {
      await setStatus.mutateAsync({ id: existing.id, status: 'draft' })
      await triggerBlogPublish()
      toast.success('Unpublished — removal deploys in ~2 minutes')
    } catch (e) {
      toast.error(e.userMessage || e.message || 'Unpublish failed')
    }
  }

  async function handleCover(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { set('cover_image_url', await uploadBlogImage(file)) }
    catch (err) { toast.error(err.userMessage || err.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  if (id && isLoading) return null

  const excerptLen = form.excerpt.length
  const saving = create.isPending || update.isPending

  return (
    <div className="space-y-5">
      <PageHeader title={existing ? 'Edit post' : 'New post'}>
        <Button variant="secondary" loading={saving} onClick={() => save().then((s) => s && toast.success('Draft saved'))}>
          Save draft
        </Button>
        {isPublished
          ? <Button variant="danger" loading={setStatus.isPending} onClick={handleUnpublish}>Unpublish</Button>
          : <Button loading={setStatus.isPending} onClick={handlePublish}>Publish</Button>}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <Label htmlFor="post-title" required>Title</Label>
            <Input id="post-title" value={form.title} onChange={(e) => set('title', e.target.value)} />
            <FieldError>{error === 'Title is required' ? error : null}</FieldError>
          </div>

          <div>
            <Label htmlFor="post-slug">
              Slug {slugLocked && <span className="text-fg-subtle">(locked — post is published)</span>}
            </Label>
            <Input
              id="post-slug"
              value={form.slug}
              disabled={slugLocked}
              onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value) || e.target.value) }}
            />
          </div>

          <div>
            <Label htmlFor="post-category">Category</Label>
            <Select id="post-category" value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="release">Feature release</option>
              <option value="update">Product update</option>
              <option value="press">Press</option>
            </Select>
          </div>

          {form.category === 'press' && (
            <div>
              <Label htmlFor="post-external">External article URL (optional — makes this a link-out)</Label>
              <Input
                id="post-external"
                placeholder="https://…"
                value={form.external_url}
                onChange={(e) => set('external_url', e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="post-excerpt">
              Excerpt{' '}
              <span className={excerptLen > EXCERPT_TARGET ? 'text-warning' : 'text-fg-subtle'}>
                ({excerptLen}/{EXCERPT_TARGET})
              </span>
            </Label>
            <Textarea id="post-excerpt" rows={2} maxLength={300} value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
          </div>

          <div>
            <Label>Cover image</Label>
            {form.cover_image_url && (
              <img src={form.cover_image_url} alt="Cover preview" className="mb-2 max-h-40 rounded-lg border border-border" />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
                {form.cover_image_url ? 'Replace image' : 'Upload image'}
              </Button>
              {form.cover_image_url && (
                <Button variant="ghost" size="sm" onClick={() => set('cover_image_url', null)}>Remove</Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleCover} />
          </div>

          <div>
            <Label htmlFor="post-body">Body (Markdown)</Label>
            <Textarea id="post-body" className="font-mono text-xs" rows={18} value={form.body_md} onChange={(e) => set('body_md', e.target.value)} />
          </div>
        </Card>

        <Card>
          <Label>Preview</Label>
          <div className="space-y-3 text-sm leading-relaxed text-fg" dangerouslySetInnerHTML={preview} />
        </Card>
      </div>
    </div>
  )
}
