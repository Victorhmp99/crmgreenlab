import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchLeadChannels, createLeadChannel, updateLeadChannel, deleteLeadChannel,
} from '@/services/leadChannels'
import type { LeadChannel } from '@/types'

export function useLeadChannels() {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey:  ['lead-channels', tenantId],
    queryFn:   () => fetchLeadChannels(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useLeadChannelMutations() {
  const queryClient = useQueryClient()
  const tenantId    = useAuthStore((s) => s.tenant?.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['lead-channels', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['leads', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['report-channels', tenantId] })
  }

  const create = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      createLeadChannel(tenantId!, name, color),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<LeadChannel, 'name' | 'color' | 'position'>> }) =>
      updateLeadChannel(id, data),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: deleteLeadChannel,
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
