import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { createLead, updateLead, deleteLead, deleteLeadsBulk, type LeadFormData } from '@/services/leads'

export function useLeadMutations() {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)

  // Invalida todas as queries que dependem de leads
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['leads',                   tenantId] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics',       tenantId] })
    queryClient.invalidateQueries({ queryKey: ['pipeline-cards',          tenantId] })
    queryClient.invalidateQueries({ queryKey: ['report-sellers',          tenantId] })
    queryClient.invalidateQueries({ queryKey: ['report-funnel',           tenantId] })
    queryClient.invalidateQueries({ queryKey: ['report-channels',         tenantId] })
    queryClient.invalidateQueries({ queryKey: ['report-conversion-funnel',tenantId] })
    queryClient.invalidateQueries({ queryKey: ['goals',                   tenantId] })
    queryClient.invalidateQueries({ queryKey: ['goals-mine',              tenantId] })
    queryClient.invalidateQueries({ queryKey: ['financial-summary',       tenantId] })
    queryClient.invalidateQueries({ queryKey: ['financial-trend',         tenantId] })
    queryClient.invalidateQueries({ queryKey: ['financial-transactions',  tenantId] })
    queryClient.invalidateQueries({ queryKey: ['funnel-metrics',          tenantId] })
  }

  const create = useMutation({
    mutationFn: (data: LeadFormData) => {
      if (!tenantId) throw new Error('Tenant não carregado. Faça logout e login novamente.')
      return createLead(tenantId, data)
    },
    onSuccess: invalidate,
    onError: (err) => console.error('[Lead] create error:', err),
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

  const removeMany = useMutation({
    mutationFn: (ids: string[]) => deleteLeadsBulk(ids),
    onSuccess: invalidate,
  })

  return { create, update, remove, removeMany }
}
