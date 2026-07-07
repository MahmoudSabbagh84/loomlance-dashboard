import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { invokeEdge } from '@/api/edge'

// Admin-only: wipes demo@loomlance.com and re-seeds the canonical screencast fixture.
// See migration 20260706201216_reset_demo_user.sql for what gets touched.
export async function resetDemoUser() {
  const { error } = await supabase.rpc('reset_demo_user')
  if (error) throw mapPostgresError(error)
}

// Admin-only: one payload with every Business Pulse number (users, tiers, Stripe, usage).
// Server enforces the admin gate; see supabase/functions/admin-metrics.
export async function fetchAdminMetrics() {
  return invokeEdge('admin-metrics')
}

// Admin-only: user lookup & support actions (list/detail/comp/ban/unban).
// Server enforces all guards; see supabase/functions/admin-users.
export async function adminUsersAction(body) {
  return invokeEdge('admin-users', body)
}
