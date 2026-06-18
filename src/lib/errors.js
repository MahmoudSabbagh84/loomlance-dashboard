export class AppError extends Error {
  constructor(code, userMessage, cause) {
    super(userMessage)
    this.code = code
    this.userMessage = userMessage
    this.cause = cause
  }
}

const CODE_MESSAGES = {
  PROJECT_LIMIT_EXCEEDED: 'You’ve hit your project limit. Upgrade to add more.',
  INVOICE_NUMBER_TAKEN: 'That invoice number is already in use. Pick a different one.',
  INVOICE_LIMIT_EXCEEDED: 'You’ve hit your invoice limit for this period.',
  STRIPE_NOT_CONNECTED: 'Connect your Stripe account in Profile → Payments first.',
  INVOICE_LINK_INVALID: 'This invoice link is no longer valid.',
  MOCK_PAYMENTS_DISABLED: 'Online payments aren’t available right now.',
  TIER_FEATURE_LOCKED: 'This feature is on a higher tier. Upgrade to use it.',
  UNAUTHORIZED: 'You don’t have permission to do that.',
  NOT_FOUND: 'Couldn’t find what you were looking for.',
  UNKNOWN: 'Something went wrong. Please try again.',
}

function detectCode(supabaseError) {
  // pgRST raises P0001 for raise exception; the trigger sets message = code keyword
  if (supabaseError.code === 'P0001' && supabaseError.message) {
    const code = supabaseError.message.trim().split(/\s+/)[0]
    if (CODE_MESSAGES[code]) return code
  }
  if (supabaseError.code === '23505') {
    const m = supabaseError.message || ''
    if (m.includes('invoices_user_id_invoice_number_key')) return 'INVOICE_NUMBER_TAKEN'
  }
  if (supabaseError.code === '42501' || supabaseError.code === 'PGRST301') return 'UNAUTHORIZED'
  if (supabaseError.code === 'PGRST116') return 'NOT_FOUND'
  return 'UNKNOWN'
}

export function mapPostgresError(err) {
  if (err instanceof AppError) return err
  const code = detectCode(err || {})
  return new AppError(code, CODE_MESSAGES[code], err)
}
