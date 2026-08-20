import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchCarteiraContratos, fetchVendas } from '@/services/contractStats'

/**
 * Mesma queryKey usada por qualquer card que precise da carteira do período
 * — o React Query deduplica e os cards compartilham uma única chamada.
 */
export function useCarteiraContratos(from: string, to: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['carteira-contratos', tenantId, from, to],
    queryFn:  () => fetchCarteiraContratos(tenantId!, from, to),
    enabled:  !!tenantId,
  })
}

/**
 * Ranking de produtos e de categorias do período. Vêm juntos de propósito:
 * são a mesma venda vista de dois ângulos, e uma queryKey só garante que os
 * dois cards nunca mostrem períodos diferentes.
 */
export function useVendas(from: string, to: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['vendas-por-produto', tenantId, from, to],
    queryFn:  () => fetchVendas(tenantId!, from, to),
    enabled:  !!tenantId,
  })
}
