import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { invokeEdge } from '@/api/edge'

const COLS = 'id, slug, title, excerpt, body_md, cover_image_url, category, external_url, status, published_at, created_at, updated_at'

export async function listPosts() {
  const { data, error } = await supabase.from('posts').select(COLS).order('created_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function getPost(id) {
  const { data, error } = await supabase.from('posts').select(COLS).eq('id', id).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function createPost(fields) {
  const { data, error } = await supabase.from('posts').insert(fields).select(COLS).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updatePost(id, patch) {
  const { data, error } = await supabase.from('posts').update(patch).eq('id', id).select(COLS).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deletePost(id) {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function setPostStatus(id, status) {
  const patch = { status }
  if (status === 'published') {
    const current = await getPost(id)
    if (!current.published_at) patch.published_at = new Date().toISOString()
  }
  return updatePost(id, patch)
}

export const triggerBlogPublish = () => invokeEdge('trigger-blog-publish', {})
