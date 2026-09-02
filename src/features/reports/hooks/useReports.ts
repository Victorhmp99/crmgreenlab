import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchSellerPerformance,
  fetchFunnelBreakdown,
  fetchCampaignPerformance,
  fetchSourceBreakdown,
  fetchChannelBreakdown,
  fetchPipelineBreakdown,
  fetchConversionFunnelMetrics,
  fetchPipelineFunnel,
} from '@/services/reports'

export function useSellerPerformance(startDate: string, endDate: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-sellers', tenantId, startDate, endDate],
    queryFn:   () => fetchSellerPerformance(tenantId!, startDate, endDate),
    enabled:   !!tenantId && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5,
  })
}

export function useFunnelBreakdown() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-funnel', tenantId],
    queryFn:   () => fetchFunnelBreakdown(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCampaignPerformance(de?: string, ate?: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    // O período entra na CHAVE: sem isso o react-query devolveria o resultado
    // do período anterior e a tela não mudaria ao trocar a data.
    queryKey:  ['report-campaigns', tenantId, de, ate],
    queryFn:   () => fetchCampaignPerformance(tenantId!, de, ate),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useSourceBreakdown(de?: string, ate?: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-sources', tenantId, de, ate],
    queryFn:   () => fetchSourceBreakdown(tenantId!, de, ate),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useChannelBreakdown() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-channels', tenantId],
    queryFn:   () => fetchChannelBreakdown(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function usePipelineBreakdown(de?: string, ate?: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-pipelines', tenantId, de, ate],
    queryFn:   () => fetchPipelineBreakdown(tenantId!, de, ate),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useConversionFunnelMetrics() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-conversion-funnel', tenantId],
    queryFn:   () => fetchConversionFunnelMetrics(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function usePipelineFunnel(pipelineId: string | null, de?: string, ate?: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-pipeline-funnel', tenantId, pipelineId, de, ate],
    queryFn:   () => fetchPipelineFunnel(tenantId!, pipelineId!, de, ate),
    enabled:   !!tenantId && !!pipelineId,
    staleTime: 1000 * 60,
  })
}
