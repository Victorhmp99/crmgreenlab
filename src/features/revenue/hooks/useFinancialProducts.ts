import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchFinancialProducts,
  createFinancialProduct,
  updateFinancialProduct,
  deactivateFinancialProduct,
  type CreateFinancialProductData,
} from '@/services/financialProducts'
import { isDemo, DEMO_PRODUCTS } from '../demoData'

export function useFinancialProducts() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['financial-products', tenantId],
    queryFn:   isDemo ? async () => DEMO_PRODUCTS : () => fetchFinancialProducts(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useFinancialProductMutations() {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['financial-products', tenantId] })
  }

  const create = useMutation({
    mutationFn: (data: CreateFinancialProductData) => createFinancialProduct(tenantId!, data),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinancialProductData> }) =>
      updateFinancialProduct(id, data),
    onSuccess: invalidate,
  })

  const deactivate = useMutation({
    mutationFn: deactivateFinancialProduct,
    onSuccess:  invalidate,
  })

  return { create, update, deactivate }
}
