import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/posts'

export function usePosts() {
  return useQuery({ queryKey: ['posts', 'list'], queryFn: api.listPosts })
}

export function usePost(id) {
  return useQuery({ queryKey: ['posts', 'detail', id], queryFn: () => api.getPost(id), enabled: !!id })
}

export function useCreatePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createPost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] }),
  })
}

export function useUpdatePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => api.updatePost(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['posts', 'list'] })
      qc.invalidateQueries({ queryKey: ['posts', 'detail', id] })
    },
  })
}

export function useDeletePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deletePost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] }),
  })
}

export function useSetPostStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => api.setPostStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['posts', 'list'] })
      qc.invalidateQueries({ queryKey: ['posts', 'detail', id] })
    },
  })
}
