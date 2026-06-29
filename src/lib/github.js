// GitHub App install URL + slug config. The slug is owner-set (VITE_GITHUB_APP_SLUG);
// the app must still boot when it's unset (|| '').
export const GITHUB_APP_SLUG = import.meta.env.VITE_GITHUB_APP_SLUG || ''

export function buildInstallUrl(slug, nonce) {
  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(nonce)}`
}

export function githubInstallUrl(nonce) {
  return buildInstallUrl(GITHUB_APP_SLUG, nonce)
}
