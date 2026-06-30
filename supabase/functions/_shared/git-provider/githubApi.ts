// GitHub App auth + REST helpers for the connect flow. `createAppJwt` is pure and unit-tested;
// the fetch helpers are integration-verified (owner). RS256 via Web Crypto — no external deps.

const GH_API = 'https://api.github.com'

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(body)
  const der = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i)
  return der
}

// Build a signed GitHub App JWT (RS256). `nowSec` defaults to the current time.
export async function createAppJwt(appId: string, pkcs8Pem: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const enc = new TextEncoder()
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = { iat: nowSec - 60, exp: nowSec + 540, iss: String(appId) }
  const signingInput = `${base64url(enc.encode(JSON.stringify(header)))}.${base64url(enc.encode(JSON.stringify(payload)))}`
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(pkcs8Pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput))
  return `${signingInput}.${base64url(new Uint8Array(sig))}`
}

async function gh(token: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'LoomLance',
    },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}: ${await res.text()}`)
  return res
}

export async function getInstallationToken(appId: string, pkcs8Pem: string, installationId: number): Promise<string> {
  const jwt = await createAppJwt(appId, pkcs8Pem)
  const res = await gh(jwt, `/app/installations/${installationId}/access_tokens`, { method: 'POST' })
  const { token } = await res.json()
  if (!token) throw new Error('GitHub did not return an installation token')
  return token
}

export async function getInstallation(appId: string, pkcs8Pem: string, installationId: number): Promise<{ account_login: string | null; account_type: string | null }> {
  const jwt = await createAppJwt(appId, pkcs8Pem)
  const data = await (await gh(jwt, `/app/installations/${installationId}`)).json()
  return { account_login: data.account?.login ?? null, account_type: data.account?.type ?? null }
}

// Uninstall the App from the account (revokes its repo access). GitHub returns 204.
export async function deleteInstallation(appId: string, pkcs8Pem: string, installationId: number): Promise<void> {
  const jwt = await createAppJwt(appId, pkcs8Pem)
  await gh(jwt, `/app/installations/${installationId}`, { method: 'DELETE' })
}

export async function listInstallationRepos(token: string): Promise<Array<{ id: number; full_name: string; default_branch: string }>> {
  const data = await (await gh(token, `/installation/repositories?per_page=100`)).json()
  return (data.repositories ?? []).map((r: any) => ({ id: r.id, full_name: r.full_name, default_branch: r.default_branch }))
}

export async function listOpenIssues(token: string, fullName: string): Promise<any[]> {
  const data = await (await gh(token, `/repos/${fullName}/issues?state=open&per_page=100`)).json()
  return (data ?? []).filter((i: any) => !i.pull_request)
}
