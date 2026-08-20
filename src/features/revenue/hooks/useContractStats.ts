import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchCarteiraContratos, fetchProdutosMaisVendidos } from '@/services/contractStats'

/**
 * Mesma queryKey usada por qualquer card que precise da carteira do período
 * (Carteira de contratos, MRR × TCV) — o React Query deduplica e os dois
 * cards compartilham uma única chamada de rede.
 */
export function useCarteiraContratos(from: string, to: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['carteira-contratos', tenantId, from, to],
    queryFn:  () => fetchCarteiraContratos(tenantId!, from, to),
    enabled:  !!tenantId,
  })
}

export function useProdutosMaisVendidos(from: string, to: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['produtos-mais-vendidos', tenantId, from, to],
    queryFn:  () => fetchProdutosMaisVendidos(tenantId!, from, to),
    enabled:  !!tenantId,
  })
}
