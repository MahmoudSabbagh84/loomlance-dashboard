import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/vault'

export function useVaultCredentials() {
  return useQuery({ queryKey: ['vault'], queryFn: api.listVaultCredentials })
}

function useVaultMutation(fn) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }) })
}

export function useSaveVaultCredential() {
  return useVaultMutation(api.saveVaultCredentialWithSecret)
}
export function useUpdateVaultMetadata() {
  return useVaultMutation(({ id, patch }) => api.updateVaultMetadata(id, patch))
}
export function useDeleteVaultCredential() {
  return useVaultMutation(api.deleteVaultCredential)
}

// Reveal is not cached — it fetches plaintext on demand and the caller shows it transiently.
export function useRevealVaultSecret() {
  return useMutation({ mutationFn: api.revealVaultSecret })
}
