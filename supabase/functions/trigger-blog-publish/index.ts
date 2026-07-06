// trigger-blog-publish — authenticated, admin-only. Fires a repository_dispatch event on the
// loomlance-splash repo so its build/deploy workflow picks up newly published posts. Called by
// the admin post editor (src/api/posts.js:triggerBlogPublish) right after a post is published.
// Secrets: GITHUB_BLOG_DISPATCH_TOKEN (fine-grained PAT, loomlance-splah repo, Contents: read/write)
// Deploy: supabase functions deploy trigger-blog-publish
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'

const REPO = 'MahmoudSabbagh84/loomlance-splah'

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const { data: profile } = await userClient.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return json({ error: 'Admin only' }, 403)

    const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('GITHUB_BLOG_DISPATCH_TOKEN')}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'blog_publish' }),
    })
    if (res.status !== 204) {
      // Log the GitHub status only — never the token or full response body, which could echo it back.
      console.error('trigger-blog-publish: dispatch failed', res.status)
      return json({ error: `GitHub dispatch failed (${res.status})` }, 502)
    }
    return json({ ok: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
