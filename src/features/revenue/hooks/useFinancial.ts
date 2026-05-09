import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchFinancialSummary,
  fetchMonthlyTrend,
  fetchTransactions,
  type FinancialFilters,
} from '@/services/financial'

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
