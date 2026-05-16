import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchWhatsappSettings, updateWhatsappSettings, regenerateWhatsappToken,
  type UpdateWhatsappSettingsData,
} from '@/services/whatsapp'

export function useWhatsappSettings() {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey:  ['whatsapp-settings', tenantId],
    queryFn:   () => fetchWhatsappSettings(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 30,
  })
}

export function useWhatsappMutations() {
  const queryClient = useQueryClient()
  const tenantId    = useAuthStore((s) => s.tenant?.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['whatsapp-settings', tenantId] })
  }

  const save = useMutation({
    mutationFn: (data: UpdateWhatsappSettingsData) => updateWhatsappSettings(tenantId!, data),
    onSuccess:  invalidate,
  })

  const regenerateToken = useMutation({
    mutationFn: () => regenerateWhatsappToken(tenantId!),
    onSuccess:  invalidate,
  })

  return { save, regenerateToken }
}
