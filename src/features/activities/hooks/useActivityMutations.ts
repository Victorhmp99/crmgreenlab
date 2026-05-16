import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { createActivity, deleteActivity, deleteActivitiesBulk, type CreateActivityData } from '@/services/activities'

export function useActivityMutations() {
  const queryClient = useQueryClient()
  const tenant = useAuthStore((s) => s.tenant)
  const user   = useAuthStore((s) => s.user)

  // Invalida tudo que pode depender de disparos (lista, timeline, stats, funil, reports)
  function invalidateAll(leadId?: string) {
    queryClient.invalidateQueries({ queryKey: ['activities',                tenant?.id] })
    if (leadId) {
      queryClient.invalidateQueries({ queryKey: ['lead-activities',         leadId] })
    }
    queryClient.invalidateQueries({ queryKey: ['activity-stats',            tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics',         tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['funnel-metrics',            tenant?.id] })
    // Relatórios também dependem de disparos
    queryClient.invalidateQueries({ queryKey: ['report-sellers',            tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['report-funnel',             tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['report-campaigns',          tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['report-sources',            tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['report-channels',           tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['report-conversion-funnel',  tenant?.id] })
  }

  const create = useMutation({
    mutationFn: (data: CreateActivityData) =>
      createActivity(tenant!.id, user!.id, user!.email!, data),
    onSuccess: (_result, variables) => invalidateAll(variables.lead_id),
  })

  const remove = useMutation({
    mutationFn: (params: { id: string; leadId?: string }) => deleteActivity(params.id),
    onSuccess: (_result, variables) => invalidateAll(variables.leadId),
  })

  const removeMany = useMutation({
    mutationFn: (ids: string[]) => deleteActivitiesBulk(ids),
    onSuccess: () => invalidateAll(),
  })

  return { create, remove, removeMany }
}
