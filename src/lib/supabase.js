import { createClient } from '@supabase/supabase-js'
import { rememberMeStorage } from '@/lib/authStorage'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // "Remember me" routes the session to localStorage (persist) or
    // sessionStorage (clears on tab close); see lib/authStorage.
    storage: rememberMeStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
