import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  moveCard,
  reorderCards,
  addLeadToPipeline,
  removeFromPipeline,
  logStageChange,
} from '@/services/pipeline'

export function usePipelineMutations() {
  const queryClient = useQueryClient()
  const tenant  = useAuthStore((s) => s.tenant)
  const user    = useAuthStore((s) => s.user)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['pipeline-cards', tenant?.id] })
  }

  const move = useMutation({
    mutationFn: async ({
      cardId,
      newStageId,
      newPosition,
      fromStageName,
      toStageName,
      leadId,
    }: {
      cardId: string
      newStageId: string
      newPosition: number
      fromStageName: string
      toStageName: string
      leadId: string
    }) => {
      await moveCard(cardId, newStageId, newPosition, user!.id)

      // Só loga atividade quando a etapa realmente muda
      if (fromStageName !== toStageName) {
        await logStageChange(tenant!.id, leadId, user!.id, fromStageName, toStageName)
      }
    },
    onSuccess: invalidate,
  })

  const reorder = useMutation({
    mutationFn: reorderCards,
    onSuccess:  invalidate,
  })

  const add = useMutation({
    mutationFn: ({
      leadId,
      stageId,
      position,
    }: {
      leadId: string
      stageId: string
      position: number
    }) => addLeadToPipeline(tenant!.id, leadId, stageId, position),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: removeFromPipeline,
    onSuccess:  invalidate,
  })

  return { move, reorder, add, remove }
}
