import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { createActivity, type CreateActivityData } from '@/services/activities'

export function useActivityMutations() {
  const queryClient = useQueryClient()
  const tenant = useAuthStore((s) => s.tenant)
  const user   = useAuthStore((s) => s.user)

  const create = useMutation({
    mutationFn: (data: CreateActivityData) =>
      createActivity(tenant!.id, user!.id, user!.email!, data),
    onSuccess: (_result, variables) => {
      // Invalida lista global + timeline do lead específico
      queryClient.invalidateQueries({ queryKey: ['activities',       tenant?.id] })
      queryClient.invalidateQueries({ queryKey: ['lead-activities',  variables.lead_id] })
      queryClient.invalidateQueries({ queryKey: ['activity-stats',   tenant?.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics', tenant?.id] })
    },
  })

  return { create }
}
