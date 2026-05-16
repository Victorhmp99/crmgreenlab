import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import {
  fetchFunnelSteps, fetchFunnelMetrics,
  createFunnelStep, updateFunnelStep, deleteFunnelStep, reorderFunnelSteps,
  type CreateFunnelStepData, type UpdateFunnelStepData,
} from '@/services/funnelSteps'

// Confirma se a migration funnel_activity_based.sql foi aplicada.
// Retorna a string da versão ou null se a função não existe.
export function useFunnelVersion() {
  return useQuery({
    queryKey: ['funnel-version'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('funnel_version')
      if (error) return null
      return data as string | null
    },
    staleTime: 1000 * 60 * 10,
    retry: false,
  })
}

export function useFunnelSteps() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['funnel-steps', tenantId],
    queryFn:   () => fetchFunnelSteps(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useFunnelMetrics() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['funnel-metrics', tenantId],
    queryFn:   () => fetchFunnelMetrics(tenantId!),
    enabled:   !!tenantId,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useFunnelStepMutations() {
  const queryClient = useQueryClient()
  const tenantId    = useAuthStore((s) => s.tenant?.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['funnel-steps',   tenantId] })
    queryClient.invalidateQueries({ queryKey: ['funnel-metrics', tenantId] })
  }

  const create = useMutation({
    mutationFn: (data: CreateFunnelStepData) => createFunnelStep(tenantId!, data),
    onSuccess:  invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFunnelStepData }) =>
      updateFunnelStep(id, data),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteFunnelStep(id),
    onSuccess: invalidate,
  })

  const reorder = useMutation({
    mutationFn: (updates: Array<{ id: string; position: number }>) =>
      reorderFunnelSteps(tenantId!, updates),
    onSuccess: invalidate,
  })

  return { create, update, remove, reorder }
}
