// Shared tier helper for edge functions. The paywall the pricing page advertises is enforced
// server-side here (not just in the client UI), because a client gate is bypassable with the
// user's own JWT. Mirrors src/lib/tier.js: Freelancer (tier_1) and Studio (tier_2) are the paid
// tiers; Solo (free) is not.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const PAID_TIERS = ['tier_1', 'tier_2'] as const

export function isPaidTier(tier: string | null | undefined): boolean {
  return tier === 'tier_1' || tier === 'tier_2'
}

// Reads the caller's subscription tier. Works with the request-scoped user client (an owner can
// read their own profiles row via RLS) or a service client. Defaults to 'free' on any miss.
export async function getSubscriptionTier(client: SupabaseClient, userId: string): Promise<string> {
  const { data } = await client.from('profiles').select('subscription_tier').eq('id', userId).maybeSingle()
  return data?.subscription_tier ?? 'free'
}
