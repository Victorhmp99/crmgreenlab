import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchTelefoniaConfig } from '@/services/telefonia'

export function useTelefoniaConfig() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['telefonia-config', tenantId],
    queryFn:  () => fetchTelefoniaConfig(tenantId!),
    enabled:  !!tenantId,
  })
}

/**
 * Se a empresa tem telefonia pronta pra discar.
 *
 * O card do lead usa isso pra decidir entre mostrar o botão "Ligar" ou só os
 * botões de registro manual — sem isso, quem não contratou veria um botão
 * que só dá erro.
 */
export function useTelefoniaAtiva(): boolean {
  const { data } = useTelefoniaConfig()
  return !!(data?.hasToken && data.ativo)
}
