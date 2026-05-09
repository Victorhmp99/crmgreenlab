import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { createLead, updateLead, deleteLead, type LeadFormData } from '@/services/leads'

export function useLeadMutations() {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['leads', tenantId] })
  }

  const create = useMutation({
    mutationFn: (data: LeadFormData) => createLead(tenantId!, data),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LeadFormData> }) =>
      updateLead(id, data),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
