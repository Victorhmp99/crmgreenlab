import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchLeadComments, createComment, updateComment, deleteComment,
  type CreateCommentData,
} from '@/services/leadComments'

export function useLeadComments(leadId: string | null) {
  return useQuery({
    queryKey:  ['lead-comments', leadId],
    queryFn:   () => fetchLeadComments(leadId!),
    enabled:   !!leadId,
    staleTime: 1000 * 30,
  })
}

export function useLeadCommentMutations(leadId: string | null) {
  const queryClient = useQueryClient()
  const tenant = useAuthStore((s) => s.tenant)
  const user   = useAuthStore((s) => s.user)

  function invalidate() {
    if (leadId) queryClient.invalidateQueries({ queryKey: ['lead-comments', leadId] })
    // O card sobe por gatilho no banco; sem recarregar o quadro aqui, a nova
    // ordem só apareceria no próximo F5.
    queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
  }

  const create = useMutation({
    mutationFn: (data: CreateCommentData) => createComment(tenant!.id, user!.id, data),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => updateComment(id, content),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
