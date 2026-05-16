import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchLeadFields, createLeadField, updateLeadField,
  deactivateLeadField, reorderLeadFields,
  type CreateFieldData, type UpdateFieldData,
} from '@/services/leadFieldDefinitions'

export function useLeadFieldDefinitions() {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey:  ['lead-field-definitions', tenantId],
    queryFn:   () => fetchLeadFields(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

// Versão filtrada — só campos ATIVOS, pra usar no LeadForm
export function useActiveLeadFields() {
  const { data, ...rest } = useLeadFieldDefinitions()
  return {
    ...rest,
    data: (data ?? []).filter((f) => f.active),
  }
}

export function useLeadFieldMutations() {
  const queryClient = useQueryClient()
  const tenantId    = useAuthStore((s) => s.tenant?.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['lead-field-definitions', tenantId] })
  }

  const create = useMutation({
    mutationFn: (data: CreateFieldData) => createLeadField(tenantId!, data),
    onSuccess:  invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFieldData }) => updateLeadField(id, data),
    onSuccess:  invalidate,
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateLeadField(id),
    onSuccess:  invalidate,
  })

  const reorder = useMutation({
    mutationFn: (updates: Array<{ id: string; position: number }>) =>
      reorderLeadFields(tenantId!, updates),
    onSuccess: invalidate,
  })

  return { create, update, deactivate, reorder }
}
