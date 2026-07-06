import { supabase } from '@/lib/supabase'
import { AppError, mapPostgresError } from '@/lib/errors'

export const BLOG_IMAGE_MAX_BYTES = 4 * 1024 * 1024 // 4 MB
export const BLOG_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const BUCKET = 'blog-images'
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export function validateBlogImageFile(file) {
  if (!file || !BLOG_IMAGE_TYPES.includes(file.type)) {
    throw new AppError('UNKNOWN', 'Use a PNG, JPG, or WebP image.')
  }
  if (file.size > BLOG_IMAGE_MAX_BYTES) {
    throw new AppError('UNKNOWN', 'Image must be under 4 MB.')
  }
}

export async function uploadBlogImage(file) {
  validateBlogImageFile(file)
  const path = `covers/${Date.now()}.${EXT[file.type]}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw mapPostgresError(error)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
