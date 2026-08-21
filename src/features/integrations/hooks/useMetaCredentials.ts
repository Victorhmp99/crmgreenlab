import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { fetchMetaCredentials } from '@/services/metaAds'

/**
 * Mesma queryKey da tela de Meta Ads — quem já abriu aquela tela não paga
 * uma segunda consulta ao abrir o funil.
 */
export function useMetaCredentials() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['meta-credentials', tenantId],
    queryFn:  () => fetchMetaCredentials(tenantId!),
    enabled:  !!tenantId,
  })
}

/**
 * Se a empresa está de fato mandando evento pro Meta.
 *
 * O Kanban usa isso pra não mostrar controle de traqueamento pra quem nunca
 * ligou a integração — seria um campo a mais na edição da coluna sem
 * significado nenhum pra maior parte das empresas.
 *
 * Vai por RPC em vez de ler meta_ads_credentials porque aquela tabela é
 * legível só por admin (ela guarda os tokens). Gestor e vendedor — justamente
 * quem vive no funil — leriam null e nunca veriam a antena na coluna.
 */
export function useCapiAtiva(): boolean {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const { data } = useQuery({
    queryKey: ['capi-ativa', tenantId],
    queryFn:  async () => {
      const { data, error } = await supabase.rpc('tenant_capi_ativa', { p_tenant_id: tenantId! })
      if (error) throw error
      return data === true
    },
    enabled:   !!tenantId,
    staleTime: 5 * 60_000,  // muda no máximo quando alguém liga/desliga a integração
  })
  return data === true
}
