// supabase/functions/_shared/adminUserGuards.ts — pure guard logic for admin-users writes.
// No I/O so every rejection branch is unit-testable. The edge function is the only caller;
// these guards are the security boundary (UI disabling is cosmetic).

export const VALID_TIERS = ['free', 'tier_1', 'tier_2'] as const
export const DEMO_USER_ID = 'd3a70000-0000-4000-8000-000000000001'

export type GuardResult = { ok: true } | { ok: false; status: 400 | 404 | 409; message: string }

export function compGuard(
  target: { id: string; stripe_subscription_id: string | null } | null,
  tier: string,
): GuardResult {
  if (!target) return { ok: false, status: 404, message: 'User not found' }
  if (!(VALID_TIERS as readonly string[]).includes(tier)) return { ok: false, status: 400, message: 'Invalid tier' }
  if (target.stripe_subscription_id) {
    return { ok: false, status: 409, message: 'This user has a live Stripe subscription — manage it in Stripe' }
  }
  return { ok: true }
}

export function banGuard(
  actorId: string,
  target: { id: string; is_admin: boolean } | null,
): GuardResult {
  if (!target) return { ok: false, status: 404, message: 'User not found' }
  if (target.id === actorId) return { ok: false, status: 409, message: 'You cannot ban your own account' }
  if (target.id === DEMO_USER_ID) return { ok: false, status: 409, message: 'The demo account cannot be banned' }
  if (target.is_admin) return { ok: false, status: 409, message: 'Admins cannot be banned from here' }
  return { ok: true }
}
