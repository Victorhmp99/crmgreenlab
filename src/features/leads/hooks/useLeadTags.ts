import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchTagDefinitions, fetchLeadTags,
  createTagDefinition, updateTagDefinition, deleteTagDefinition,
  syncLeadTags,
} from '@/services/leadTags'

export function useTagDefinitions() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['tag-definitions', tenantId],
    queryFn:   () => fetchTagDefinitions(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useLeadTags(leadId: string | null) {
  return useQuery({
    queryKey:  ['lead-tags', leadId],
    queryFn:   () => fetchLeadTags(leadId!),
    enabled:   !!leadId,
    staleTime: 1000 * 30,
  })
}

export function useTagMutations(leadId: string | null) {
  const queryClient = useQueryClient()
  const tenantId    = useAuthStore((s) => s.tenant?.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['tag-definitions', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['lead-tags',       leadId]   })
    queryClient.invalidateQueries({ queryKey: ['leads',           tenantId] })
  }

  const create = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      createTagDefinition(tenantId!, name, color),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      updateTagDefinition(id, data),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteTagDefinition(id),
    onSuccess: invalidate,
  })

  const sync = useMutation({
    mutationFn: (tagIds: string[]) => syncLeadTags(leadId!, tagIds),
    onSuccess: invalidate,
  })

  return { create, update, remove, sync }
}
