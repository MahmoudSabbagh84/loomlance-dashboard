import { supabase } from '@/lib/supabase'
import { AppError, mapPostgresError } from '@/lib/errors'

export const LOGO_MAX_BYTES = 2 * 1024 * 1024 // 2 MB
export const LOGO_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
const BUCKET = 'branding-logos'

export function validateLogoFile(file) {
  if (!file || !LOGO_TYPES.includes(file.type)) {
    throw new AppError('UNKNOWN', 'Logo must be an SVG, PNG, JPG, or WebP image.')
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new AppError('UNKNOWN', 'Logo must be under 2 MB.')
  }
}

export function logoPathFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  const marker = `/${BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length)
}

const EXT = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export async function uploadLogo(file) {
  validateLogoFile(file)
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new AppError('UNAUTHORIZED', 'You must be signed in.')
  const path = `${userId}/logo-${Date.now()}.${EXT[file.type]}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw mapPostgresError(error)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function removeLogo(logoUrl) {
  const path = logoPathFromUrl(logoUrl)
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error && error.message && !/not found/i.test(error.message)) throw mapPostgresError(error)
}
