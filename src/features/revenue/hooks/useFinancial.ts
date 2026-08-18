import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchFinancialSummary,
  fetchMonthlyTrend,
  fetchTransactions,
  fetchCategoryBreakdown,
  fetchCashFlowForecast,
  type FinancialFilters,
} from '@/services/financial'
import { fetchActiveMRR } from '@/services/clientContracts'
import { fetchFaturamentoReceita } from '@/services/dashboard'

export function useFinancialSummary(dateFrom?: string, dateTo?: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['financial-summary', tenantId, dateFrom, dateTo],
    queryFn:   () => fetchFinancialSummary(tenantId!, dateFrom, dateTo),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useMonthlyTrend(months = 12) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['financial-trend', tenantId, months],
    queryFn:   () => fetchMonthlyTrend(tenantId!, months),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useTransactions(filters: FinancialFilters = {}) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['transactions', tenantId, filters],
    queryFn:   () => fetchTransactions(tenantId!, filters),
    enabled:   !!tenantId,
    placeholderData: (prev) => prev,
  })
}

export function useCategoryBreakdown(dateFrom?: string, dateTo?: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['category-breakdown', tenantId, dateFrom, dateTo],
    queryFn:   () => fetchCategoryBreakdown(tenantId!, dateFrom, dateTo),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useCashFlowForecast(days: number) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['cash-flow-forecast', tenantId, days],
    queryFn:   () => fetchCashFlowForecast(tenantId!, days),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useFaturamentoReceita(dateFrom?: string, dateTo?: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['faturamento-receita', tenantId, dateFrom, dateTo],
    queryFn:   () => fetchFaturamentoReceita(tenantId!, dateFrom, dateTo),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useActiveMRR() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['active-mrr', tenantId],
    queryFn:   () => fetchActiveMRR(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}
