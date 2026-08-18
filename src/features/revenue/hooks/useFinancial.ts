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
import {
  isDemo, DEMO_SUMMARY, DEMO_PREV_SUMMARY, DEMO_MRR, DEMO_FATURAMENTO,
  DEMO_CATEGORY_BREAKDOWN, demoMonthlyTrend, demoCashFlow, demoTransactions,
} from '../demoData'

export function useFinancialSummary(dateFrom?: string, dateTo?: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['financial-summary', tenantId, dateFrom, dateTo],
    queryFn:   isDemo
      // no demo, o período anterior mostra números um pouco menores (pra
      // aparecer a variação % nos cards)
      ? async () => (dateTo && dateTo < new Date().toISOString().slice(0, 10) ? DEMO_PREV_SUMMARY : DEMO_SUMMARY)
      : () => fetchFinancialSummary(tenantId!, dateFrom, dateTo),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useMonthlyTrend(months = 12) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['financial-trend', tenantId, months],
    queryFn:   isDemo ? async () => demoMonthlyTrend(months) : () => fetchMonthlyTrend(tenantId!, months),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useTransactions(filters: FinancialFilters = {}) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['transactions', tenantId, filters],
    queryFn:   isDemo
      ? async () => demoTransactions(filters.page, filters.pageSize, filters.type || undefined)
      : () => fetchTransactions(tenantId!, filters),
    enabled:   !!tenantId,
    placeholderData: (prev) => prev,
  })
}

export function useCategoryBreakdown(dateFrom?: string, dateTo?: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['category-breakdown', tenantId, dateFrom, dateTo],
    queryFn:   isDemo ? async () => DEMO_CATEGORY_BREAKDOWN : () => fetchCategoryBreakdown(tenantId!, dateFrom, dateTo),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useCashFlowForecast(days: number) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['cash-flow-forecast', tenantId, days],
    queryFn:   isDemo ? async () => demoCashFlow(days) : () => fetchCashFlowForecast(tenantId!, days),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useFaturamentoReceita(dateFrom?: string, dateTo?: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['faturamento-receita', tenantId, dateFrom, dateTo],
    queryFn:   isDemo ? async () => DEMO_FATURAMENTO : () => fetchFaturamentoReceita(tenantId!, dateFrom, dateTo),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useActiveMRR() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['active-mrr', tenantId],
    queryFn:   isDemo ? async () => DEMO_MRR : () => fetchActiveMRR(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}
