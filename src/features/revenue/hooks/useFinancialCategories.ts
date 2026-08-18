import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchFinancialCategories,
  createFinancialCategory,
  deactivateFinancialCategory,
  type FinancialCategoryType,
} from '@/services/financialCategories'
import { isDemo, DEMO_CATEGORIES } from '../demoData'

export function useFinancialCategories() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['financial-categories', tenantId],
    queryFn:   isDemo ? async () => DEMO_CATEGORIES : () => fetchFinancialCategories(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useFinancialCategoryMutations() {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['financial-categories', tenantId] })
  }

  const create = useMutation({
    mutationFn: ({ name, type }: { name: string; type: FinancialCategoryType }) =>
      createFinancialCategory(tenantId!, name, type),
    onSuccess: invalidate,
  })

  const deactivate = useMutation({
    mutationFn: deactivateFinancialCategory,
    onSuccess:  invalidate,
  })

  return { create, deactivate }
}
