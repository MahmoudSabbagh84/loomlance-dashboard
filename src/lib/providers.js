// Integration mode is chosen at build time. Defaults to 'mock' so the app works with no
// external accounts; flip to the real provider only after the Edge Functions are deployed
// and their secrets are set (see pre-production.md).
export const EMAIL_PROVIDER = import.meta.env.VITE_EMAIL_PROVIDER || 'mock'
export const PAYMENTS_PROVIDER = import.meta.env.VITE_PAYMENTS_PROVIDER || 'mock'

export const emailIsReal = EMAIL_PROVIDER === 'resend'
export const paymentsAreReal = PAYMENTS_PROVIDER === 'stripe'
