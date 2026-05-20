import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import {
  fetchFunnelSteps, fetchFunnelMetrics,
  createFunnelStep, updateFunnelStep, deleteFunnelStep, reorderFunnelSteps,
  type CreateFunnelStepData, type UpdateFunnelStepData,
} from '@/services/funnelSteps'
import { fetchFunnelTotals } from '@/services/reports'

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
  // Combina fetchFunnelSteps (config dos passos) com fetchFunnelTotals
  // (contagens agregadas por categoria, sem duplicar leads).
  return useQuery({
    queryKey:  ['funnel-metrics-totals', tenantId],
    queryFn:   async () => {
      const [steps, totals] = await Promise.all([
        fetchFunnelSteps(tenantId!),
        fetchFunnelTotals(tenantId!),
      ])

      // Classifica cada passo pelo nome → categoria
      const catOf = (name: string): 'contato' | 'reuniao' | 'negociacao' | 'fechado' | 'other' => {
        const n = name.toLowerCase()
        if (/fechad|ganho|won|convertido|contrato/.test(n)) return 'fechado'
        if (/negoci|propost|or[çc]ament/.test(n))            return 'negociacao'
        if (/reuni|agenda|meeting/.test(n))                  return 'reuniao'
        if (/contato|primeiro|inicial|abord/.test(n))        return 'contato'
        return 'other'
      }

      // Pra cada passo, atribui a contagem da categoria correspondente
      return steps.map((s) => {
        const cat = catOf(s.name)
        const count =
          cat === 'contato'    ? totals.contato :
          cat === 'reuniao'    ? totals.reuniao :
          cat === 'negociacao' ? totals.negociacao :
          cat === 'fechado'    ? totals.fechado :
          totals.totalLeads  // primeiro passo (Leads Captados) = todos
        return {
          stepId:          s.id,
          stepName:        s.name,
          stepColor:       s.color,
          stepPosition:    s.position,
          countInStep:     count,
          countAtOrBeyond: count,
          countLostHere:   cat === 'other' ? 0 : (cat === 'contato' ? totals.lost : 0),
        }
      })
    },
    enabled:   !!tenantId,
    staleTime: 0,
    refetchOnMount: true,
  })
}

// Mantém o nome antigo importado pra evitar warning de unused import
void fetchFunnelMetrics

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
