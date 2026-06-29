import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { invokeEdge } from '@/api/edge'

// --- Reads (RLS-scoped to the current user) ---
export async function getInstallation() {
  const { data, error } = await supabase
    .from('github_installations')
    .select('installation_id, account_login, account_type')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw mapPostgresError(error)
  return data
}

export async function getProjectRepo(projectId) {
  const { data, error } = await supabase
    .from('project_repos')
    .select('repo_full_name, repo_id, default_branch')
    .eq('project_id', projectId)
    .is('disconnected_at', null)
    .maybeSingle()
  if (error) throw mapPostgresError(error)
  return data
}

export async function listIssueCards(projectId) {
  const { data, error } = await supabase
    .from('github_issue_cards')
    .select('id, issue_number, title, html_url, labels, assignee_login')
    .eq('project_id', projectId)
    .eq('state', 'open')
    .order('issue_number', { ascending: true })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function disconnectRepo(projectId) {
  const { error } = await supabase
    .from('project_repos')
    .update({ disconnected_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .is('disconnected_at', null)
  if (error) throw mapPostgresError(error)
}

// --- GitHub-API actions via Edge Functions ---
export const connectInstallation = (installationId) => invokeEdge('github-connect', { installationId })
export const listRepos = () => invokeEdge('github-repos', {})
export const linkRepo = (payload) => invokeEdge('github-link-repo', payload)
