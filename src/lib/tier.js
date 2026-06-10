export const FEATURES = Object.freeze({
  CUSTOM_BRANDING: 'custom_branding',
  RECURRING_INVOICES: 'recurring_invoices',
  TIME_TRACKING: 'time_tracking',
  EXPENSES: 'expenses',
  REPORTS: 'reports',
})

export const TIER_LIMITS = Object.freeze({
  free: {
    maxActiveProjects: 1,
    features: new Set([]),
  },
  tier_1: {
    maxActiveProjects: 5,
    features: new Set([FEATURES.CUSTOM_BRANDING, FEATURES.RECURRING_INVOICES, FEATURES.TIME_TRACKING]),
  },
  tier_2: {
    maxActiveProjects: Infinity,
    features: new Set([
      FEATURES.CUSTOM_BRANDING,
      FEATURES.RECURRING_INVOICES,
      FEATURES.TIME_TRACKING,
      FEATURES.EXPENSES,
      FEATURES.REPORTS,
    ]),
  },
})

export function canCreateProject(tier, currentActiveCount) {
  const limit = TIER_LIMITS[tier]?.maxActiveProjects ?? 0
  return currentActiveCount < limit
}

export function hasFeature(tier, feature) {
  return TIER_LIMITS[tier]?.features.has(feature) ?? false
}

export const UPGRADE_COPY = Object.freeze({
  active_projects: {
    title: 'You’ve hit your project limit',
    body: (tier) =>
      tier === 'free'
        ? 'Free includes 1 active project. Upgrade to Tier 1 for 5, or Tier 2 for unlimited.'
        : 'Tier 1 includes 5 active projects. Upgrade to Tier 2 for unlimited.',
  },
  [FEATURES.CUSTOM_BRANDING]: {
    title: 'Brand your invoices',
    body: () => 'Add your logo, accent color, and custom footer. Available on Tier 1 and Tier 2.',
  },
  [FEATURES.RECURRING_INVOICES]: {
    title: 'Automate monthly billing',
    body: () => 'Set up recurring invoices that send themselves. Available on Tier 1 and Tier 2.',
  },
  [FEATURES.TIME_TRACKING]: {
    title: 'Track billable hours',
    body: () => 'Built-in timer and manual entries; generate invoices from tracked time. Tier 1 and Tier 2.',
  },
  [FEATURES.EXPENSES]: {
    title: 'Track expenses with receipts',
    body: () => 'Log expenses by category and project; upload receipts. Available on Tier 2.',
  },
  [FEATURES.REPORTS]: {
    title: 'Run revenue and P&L reports',
    body: () => 'Detailed reporting on revenue, profit & loss, aging, and time. Available on Tier 2.',
  },
})

export function getSplashUpgradeUrl(target) {
  const base = import.meta.env.VITE_SPLASH_URL || 'https://splash.loomlance.com'
  return `${base}/pricing?upgrade=${encodeURIComponent(target ?? 'tier_1')}`
}
